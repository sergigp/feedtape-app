import { Post } from '../types';
import contentCleaningService from './contentCleaningService';

export type PipelinePhase = (post: Post) => Promise<Post>;

export const BATCH_SIZE = 10;

export class ContentPipelineService {
  private activeTasks = 0;
  private queue: Array<() => Promise<void>> = [];
  private batchSize: number;

  constructor(batchSize: number = BATCH_SIZE) {
    this.batchSize = batchSize;
  }

  async cleaningPhase(post: Post): Promise<Post> {
    const startTime = Date.now();
    console.log(`[Cleaning] Started for ${post.link}`);

    try {
      // Clean content
      const cleanedContent = contentCleaningService.cleanContent(post.rawContent);

      if (cleanedContent === null) {
        const duration = Date.now() - startTime;
        console.log(`[Cleaning] Failed for ${post.link} in ${duration}ms (content too short or cleaning failed)`);
        return {
          ...post,
          status: 'error',
        };
      }

      // Clean title (decode HTML entities)
      const cleanedTitle = contentCleaningService.cleanTitle(post.title);
      if (cleanedTitle !== post.title) {
        console.log(`[Cleaning] Title cleaned: "${post.title}" → "${cleanedTitle}"`);
      }

      const duration = Date.now() - startTime;
      console.log(`[Cleaning] Completed for ${post.link} in ${duration}ms`);

      return {
        ...post,
        title: cleanedTitle,
        cleanedContent,
        status: 'cleaned',
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`[Cleaning] Failed for ${post.link} in ${duration}ms:`, error);
      return {
        ...post,
        status: 'error',
      };
    }
  }

  getDefaultPhases(): PipelinePhase[] {
    return [
      this.cleaningPhase.bind(this),
      // Future: summarizationPhase
    ];
  }

  async processPost(
    post: Post,
    onUpdate: (post: Post) => void,
    phases?: PipelinePhase[]
  ): Promise<void> {
    console.log(`[Pipeline] Starting processing for ${post.link} (${post.rawContent.length} chars)`);

    const phasesToRun = phases || this.getDefaultPhases();
    let currentPost = post;

    for (const phase of phasesToRun) {
      try {
        // Update status before phase
        if (phase === this.cleaningPhase) {
          currentPost = { ...currentPost, status: 'cleaning' };
          onUpdate(currentPost);
        }

        // Run phase
        currentPost = await phase(currentPost);

        // Update status after phase
        console.log(`[Pipeline] Post ${currentPost.link} status: ${currentPost.status}`);
        onUpdate(currentPost);

        // Stop if error occurred
        if (currentPost.status === 'error') {
          break;
        }
      } catch (error) {
        console.error(`[Pipeline] Phase failed for ${post.link}:`, error);
        currentPost = { ...currentPost, status: 'error' };
        onUpdate(currentPost);
        break;
      }
    }
  }

  async runQueuedTask(): Promise<void> {
    if (this.queue.length === 0 || this.activeTasks >= this.batchSize) {
      return;
    }

    const task = this.queue.shift();
    if (!task) return;

    this.activeTasks++;
    try {
      await task();
    } finally {
      this.activeTasks--;
      // Process next queued task if available
      await this.runQueuedTask();
    }
  }

  processPosts(
    posts: Post[],
    onUpdate: (post: Post) => void,
    phases?: PipelinePhase[]
  ): void {
    console.log(`[Pipeline] Starting batch processing for ${posts.length} posts (batch size: ${this.batchSize})`);

    // Add all posts to queue
    posts.forEach((post) => {
      const task = async () => {
        await this.processPost(post, onUpdate, phases);
      };
      this.queue.push(task);
    });

    // Start initial batch
    const initialBatchSize = Math.min(this.batchSize, this.queue.length);
    for (let i = 0; i < initialBatchSize; i++) {
      this.runQueuedTask();
    }

    console.log(`[Pipeline] Queued ${posts.length} posts for processing`);
  }

  // Exposed for testing
  getActiveTasks(): number {
    return this.activeTasks;
  }

  getQueueLength(): number {
    return this.queue.length;
  }

  clearQueue(): void {
    this.queue = [];
    this.activeTasks = 0;
  }
}

export default new ContentPipelineService();
