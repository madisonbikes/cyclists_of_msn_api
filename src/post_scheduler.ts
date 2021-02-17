import { PostHistory } from "./database/post_history.model";
import { PostHistoryDocument, PostStatus } from "./database/post_history.types";
import { ImageDocument } from "./database/images.types";
import { Image } from "./database/images.model";
import { randomInt } from "./utils/random";
import date_set from "date-fns/set";
import date_add from "date-fns/add";
import startOfToday from "date-fns/startOfToday";
import { differenceInMinutes, isFuture, startOfTomorrow } from "date-fns";
import { configuration } from "./config";
import { Result, ok, error } from "./utils/result";
import { logger } from "./utils/logger";

export type PostResult = Result<PostHistoryDocument, PostError>
export type PostError = { message: string }

export async function scheduleNextPost(now = new Date()): Promise<PostResult> {
  const nextPost = await PostHistory.findNextScheduledPost();
  if (nextPost != null) {
    logger.info(`Using existing scheduled post @ ${nextPost.timestamp}`);
    return ok(nextPost);
  }

  const createdPost = await createNewScheduledPost(now);
  if (createdPost.isOk()) {
    logger.info(`Scheduled new post @ ${createdPost.value.timestamp}`);
  }
  return createdPost;
}

async function createNewScheduledPost(now: Date): Promise<PostResult> {
  const [lastPost, newImage] = await Promise.all([
    PostHistory.findCurrentPost(),
    selectNextPhoto()
  ]);
  const newPost = new PostHistory();
  if (newImage.isError()) {
    return error(newImage.value);
  }
  newPost.image = newImage.value;
  newPost.timestamp = await selectNextTime(lastPost?.timestamp, now);
  newPost.status.flag = PostStatus.PENDING;
  return ok(await newPost.save());
}

async function selectNextPhoto(): Promise<Result<ImageDocument, PostError>> {
  const allImages = await Image.find().where({ deleted: false });
  if (allImages.length == 0) {
    return error({ message: "no images" });
  }
  const randomIndex = randomInt(0, allImages.length);
  return ok(allImages[randomIndex]);
}

async function selectNextTime(lastPostTime: Date | undefined, now: Date): Promise<Date> {
  const lastTimeToday = date_set(startOfToday(), { hours: configuration.lastPostHour });

  let startDate: Date;
  if (lastPostTime != null) {
    if (lastPostTime > startOfToday()) {
      // we already posted today
      startDate = startOfTomorrow();
    } else {
      // still need to post today
      startDate = startOfToday();
    }
  } else {
    if (now > lastTimeToday) {
      // can't post today any more, post tomorrow
      startDate = startOfTomorrow();
    } else {
      // post today
      startDate = startOfToday();
    }
  }
  let firstTime = date_set(startDate, { hours: configuration.firstPostHour });
  const lastTime = date_set(startDate, { hours: configuration.lastPostHour });

  if (!isFuture(firstTime)) {
    firstTime = now;
  }
  const diff = Math.abs(differenceInMinutes(firstTime, lastTime));
  const random_min = randomInt(0, diff);

  // return
  return date_add(firstTime, { minutes: random_min });
}