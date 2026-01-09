import { ContentPipelineService, PipelinePhase } from '../contentPipelineService';
import { Post } from '../../types';

const createMockPost = (overrides?: Partial<Post>): Post => ({
  link: 'https://example.com/post',
  feedId: 'feed-1',
  title: 'Test Post',
  pubDate: '2024-01-01',
  author: 'Test Author',
  content: '<p>Test content</p>',
  plainText: 'Test content',
  language: 'en',
  rawContent: '<p>Test content</p>',
  cleanedContent: null,
  status: 'raw',
  ...overrides,
});

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

describe('ContentPipelineService', () => {
  let service: ContentPipelineService;

  beforeEach(() => {
    service = new ContentPipelineService(3);
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    service.clearQueue();
    jest.restoreAllMocks();
  });

  describe('Queue Management', () => {
    it('should respect batch size limit', async () => {
      const posts = Array.from({ length: 10 }, (_, i) =>
        createMockPost({ link: `https://example.com/post-${i}` })
      );

      const updates: Post[] = [];
      const mockPhase: PipelinePhase = async (post) => {
        await wait(50);
        return { ...post, status: 'cleaned', cleanedContent: 'cleaned' };
      };

      service.processPosts(posts, (post) => updates.push(post), [mockPhase]);

      await wait(10);

      expect(service.getActiveTasks()).toBeLessThanOrEqual(3);
      expect(service.getQueueLength()).toBeGreaterThan(0);
    });

    it('should process all posts eventually', async () => {
      const posts = Array.from({ length: 5 }, (_, i) =>
        createMockPost({ link: `https://example.com/post-${i}` })
      );

      const updates: Post[] = [];
      const mockPhase: PipelinePhase = async (post) => {
        await wait(10);
        return { ...post, status: 'cleaned', cleanedContent: 'cleaned' };
      };

      service.processPosts(posts, (post) => updates.push(post), [mockPhase]);

      await wait(200);

      const uniquePosts = new Set(updates.map(p => p.link));
      expect(uniquePosts.size).toBe(5);
    });

    it('should start next task as soon as slot becomes available', async () => {
      const posts = Array.from({ length: 5 }, (_, i) =>
        createMockPost({ link: `https://example.com/post-${i}` })
      );

      const processingOrder: string[] = [];
      const mockPhase: PipelinePhase = async (post) => {
        processingOrder.push(`start-${post.link}`);
        await wait(30);
        processingOrder.push(`end-${post.link}`);
        return { ...post, status: 'cleaned', cleanedContent: 'cleaned' };
      };

      service.processPosts(posts, () => {}, [mockPhase]);

      await wait(10);
      expect(service.getActiveTasks()).toBe(3);

      await wait(40);
      expect(processingOrder.filter(o => o.startsWith('start')).length).toBeGreaterThan(3);
    });

    it('should clear queue properly', () => {
      const posts = Array.from({ length: 5 }, (_, i) =>
        createMockPost({ link: `https://example.com/post-${i}` })
      );

      service.processPosts(posts, () => {}, []);
      expect(service.getQueueLength()).toBeGreaterThan(0);

      service.clearQueue();
      expect(service.getQueueLength()).toBe(0);
      expect(service.getActiveTasks()).toBe(0);
    });
  });

  describe('Phase Orchestration', () => {
    it('should call phases in sequential order', async () => {
      const post = createMockPost();
      const callOrder: string[] = [];

      const phase1: PipelinePhase = async (p) => {
        callOrder.push('phase1');
        return { ...p, status: 'cleaning' };
      };

      const phase2: PipelinePhase = async (p) => {
        callOrder.push('phase2');
        return { ...p, status: 'cleaned', cleanedContent: 'cleaned' };
      };

      await service.processPost(post, () => {}, [phase1, phase2]);

      expect(callOrder).toEqual(['phase1', 'phase2']);
    });

    it('should call onUpdate callback after each phase', async () => {
      const post = createMockPost();
      const updates: Post[] = [];

      const phase1: PipelinePhase = async (p) => ({
        ...p,
        status: 'cleaning',
      });

      const phase2: PipelinePhase = async (p) => ({
        ...p,
        status: 'cleaned',
        cleanedContent: 'cleaned',
      });

      await service.processPost(
        post,
        (p) => updates.push(p),
        [phase1, phase2]
      );

      expect(updates.length).toBe(2);
      expect(updates[0].status).toBe('cleaning');
      expect(updates[1].status).toBe('cleaned');
    });

    it('should pass updated post to next phase', async () => {
      const post = createMockPost();

      const phase1: PipelinePhase = async (p) => ({
        ...p,
        cleanedContent: 'step1',
      });

      const phase2: PipelinePhase = async (p) => {
        expect(p.cleanedContent).toBe('step1');
        return { ...p, cleanedContent: 'step2' };
      };

      await service.processPost(post, () => {}, [phase1, phase2]);
    });

    it('should stop processing on error status', async () => {
      const post = createMockPost();
      let phase3Called = false;

      const phase1: PipelinePhase = async (p) => ({
        ...p,
        status: 'cleaning',
      });

      const phase2: PipelinePhase = async (p) => ({
        ...p,
        status: 'error',
      });

      const phase3: PipelinePhase = async (p) => {
        phase3Called = true;
        return p;
      };

      await service.processPost(post, () => {}, [phase1, phase2, phase3]);

      expect(phase3Called).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should handle phase throwing error', async () => {
      const post = createMockPost();
      const updates: Post[] = [];

      const failingPhase: PipelinePhase = async () => {
        throw new Error('Phase failed');
      };

      await service.processPost(
        post,
        (p) => updates.push(p),
        [failingPhase]
      );

      const lastUpdate = updates[updates.length - 1];
      expect(lastUpdate.status).toBe('error');
    });

    it('should not affect other posts if one fails', async () => {
      const posts = [
        createMockPost({ link: 'https://example.com/post-1' }),
        createMockPost({ link: 'https://example.com/post-2' }),
        createMockPost({ link: 'https://example.com/post-3' }),
      ];

      const updates: Post[] = [];
      const mockPhase: PipelinePhase = async (post) => {
        if (post.link === 'https://example.com/post-2') {
          throw new Error('Post 2 failed');
        }
        return { ...post, status: 'cleaned', cleanedContent: 'cleaned' };
      };

      service.processPosts(posts, (p) => updates.push(p), [mockPhase]);

      await wait(100);

      const post1Updates = updates.filter(p => p.link === 'https://example.com/post-1');
      const post2Updates = updates.filter(p => p.link === 'https://example.com/post-2');
      const post3Updates = updates.filter(p => p.link === 'https://example.com/post-3');

      expect(post1Updates.some(p => p.status === 'cleaned')).toBe(true);
      expect(post2Updates.some(p => p.status === 'error')).toBe(true);
      expect(post3Updates.some(p => p.status === 'cleaned')).toBe(true);
    });

    it('should log error when phase fails', async () => {
      const post = createMockPost();
      const errorSpy = jest.spyOn(console, 'error');

      const failingPhase: PipelinePhase = async () => {
        throw new Error('Test error');
      };

      await service.processPost(post, () => {}, [failingPhase]);

      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('[Pipeline] Phase failed'),
        expect.any(Error)
      );
    });

    it('should continue to next post after error', async () => {
      const posts = Array.from({ length: 5 }, (_, i) =>
        createMockPost({ link: `https://example.com/post-${i}` })
      );

      const updates: Post[] = [];
      const mockPhase: PipelinePhase = async (post) => {
        if (post.link === 'https://example.com/post-1') {
          throw new Error('Post 1 failed');
        }
        await wait(10);
        return { ...post, status: 'cleaned', cleanedContent: 'cleaned' };
      };

      service.processPosts(posts, (p) => updates.push(p), [mockPhase]);

      await wait(200);

      const successfulPosts = updates.filter(p => p.status === 'cleaned');
      expect(successfulPosts.length).toBe(4);
    });
  });

  describe('Integration with Async Operations', () => {
    it('should handle async phases with different durations', async () => {
      const post = createMockPost();
      const timestamps: number[] = [];

      const fastPhase: PipelinePhase = async (p) => {
        await wait(10);
        timestamps.push(Date.now());
        return { ...p, status: 'cleaning' };
      };

      const slowPhase: PipelinePhase = async (p) => {
        await wait(50);
        timestamps.push(Date.now());
        return { ...p, status: 'cleaned', cleanedContent: 'cleaned' };
      };

      await service.processPost(post, () => {}, [fastPhase, slowPhase]);

      expect(timestamps.length).toBe(2);
      expect(timestamps[1] - timestamps[0]).toBeGreaterThanOrEqual(50);
    });

    it('should handle many posts with varying processing times', async () => {
      const posts = Array.from({ length: 10 }, (_, i) =>
        createMockPost({ link: `https://example.com/post-${i}` })
      );

      const updates: Post[] = [];
      const mockPhase: PipelinePhase = async (post) => {
        const delay = Math.random() * 30;
        await wait(delay);
        return { ...post, status: 'cleaned', cleanedContent: 'cleaned' };
      };

      service.processPosts(posts, (p) => updates.push(p), [mockPhase]);

      await wait(300);

      const uniquePosts = new Set(updates.map(p => p.link));
      expect(uniquePosts.size).toBe(10);
    });
  });
});
