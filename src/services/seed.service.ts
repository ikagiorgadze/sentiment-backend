import { pool } from '../config/database';

export class SeedService {
  async seedDatabase(): Promise<any> {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      // Clear existing data
      await client.query('DELETE FROM reactions');
      await client.query('DELETE FROM sentiments');
      await client.query('DELETE FROM comments');
  await client.query('DELETE FROM posts');
  await client.query('DELETE FROM pages');
      await client.query('DELETE FROM users WHERE id NOT IN (SELECT id FROM auth_users)'); // Keep auth users
      
      // Create users
      const users = [
        { fb_profile_id: '100001234567890', full_name: 'John Smith' },
        { fb_profile_id: '100009876543210', full_name: 'Sarah Johnson' },
        { fb_profile_id: '100005555555555', full_name: 'Mike Chen' },
        { fb_profile_id: '100007777777777', full_name: 'Emily Rodriguez' },
        { fb_profile_id: '100003333333333', full_name: 'David Kim' },
        { fb_profile_id: '100008888888888', full_name: 'Lisa Anderson' },
        { fb_profile_id: '100002222222222', full_name: 'James Wilson' },
        { fb_profile_id: '100006666666666', full_name: 'Maria Garcia' },
      ];

      const userIds: string[] = [];
      for (const user of users) {
        const result = await client.query(
          'INSERT INTO users (fb_profile_id, full_name) VALUES ($1, $2) RETURNING id',
          [user.fb_profile_id, user.full_name]
        );
        userIds.push(result.rows[0].id);
      }

      // Create pages
      const pages = [
        { page_url: 'https://facebook.com/techcompany', page_name: 'Tech Company' },
        { page_url: 'https://facebook.com/newschannel', page_name: 'News Channel' },
        { page_url: 'https://facebook.com/foodblog', page_name: 'Food Blog' },
        { page_url: 'https://facebook.com/sportsteam', page_name: 'Sports Team' },
        { page_url: 'https://facebook.com/musicfestival', page_name: 'Music Festival' },
        { page_url: 'https://facebook.com/environmental', page_name: 'Environmental Group' },
        { page_url: 'https://facebook.com/comedy', page_name: 'Comedy Hub' },
        { page_url: 'https://facebook.com/fitness', page_name: 'Fitness Community' },
      ];

      const pageIdByUrl = new Map<string, string>();
      for (const page of pages) {
        const result = await client.query(
          'INSERT INTO pages (page_url, page_name) VALUES ($1, $2) RETURNING id',
          [page.page_url, page.page_name]
        );
        pageIdByUrl.set(page.page_url, result.rows[0].id);
      }

      // Create posts with diverse content
      const posts = [
        {
          page_url: 'https://facebook.com/techcompany',
          full_url: 'https://facebook.com/techcompany/posts/123456789',
          content: 'Excited to announce our new AI-powered product launch! This is going to revolutionize the industry. #Innovation #Tech',
        },
        {
          page_url: 'https://facebook.com/newschannel',
          full_url: 'https://facebook.com/newschannel/posts/987654321',
          content: 'Breaking: Local community comes together to support families affected by recent storms. Heartwarming stories of resilience.',
        },
        {
          page_url: 'https://facebook.com/foodblog',
          full_url: 'https://facebook.com/foodblog/posts/456789123',
          content: 'Just tried the new restaurant downtown and I have to say... worst experience ever. Service was terrible and food was cold.',
        },
        {
          page_url: 'https://facebook.com/sportsteam',
          full_url: 'https://facebook.com/sportsteam/posts/789123456',
          content: 'What an incredible game last night! Our team showed amazing spirit and determination. Proud of every single player!',
        },
        {
          page_url: 'https://facebook.com/musicfestival',
          full_url: 'https://facebook.com/musicfestival/posts/321654987',
          content: 'Tickets are now available for the summer music festival. Early bird discount ends soon!',
        },
        {
          page_url: 'https://facebook.com/environmental',
          full_url: 'https://facebook.com/environmental/posts/147258369',
          content: 'Devastating news about the rainforest fires. We need to take action NOW before it\'s too late. This is a crisis.',
        },
        {
          page_url: 'https://facebook.com/comedy',
          full_url: 'https://facebook.com/comedy/posts/963852741',
          content: 'New comedy special dropping this Friday! Get ready to laugh until your sides hurt 😂',
        },
        {
          page_url: 'https://facebook.com/fitness',
          full_url: 'https://facebook.com/fitness/posts/852963741',
          content: 'Completed my first marathon today! 26.2 miles of pure determination. If I can do it, anyone can!',
        },
      ];

      const postIds: string[] = [];
      for (const post of posts) {
        const pageId = pageIdByUrl.get(post.page_url);
        if (!pageId) {
          throw new Error(`Missing page seed for URL ${post.page_url}`);
        }

        const result = await client.query(
          'INSERT INTO posts (page_id, full_url, content) VALUES ($1, $2, $3) RETURNING id',
          [pageId, post.full_url, post.content]
        );
        postIds.push(result.rows[0].id);
      }

      // Create sentiments for posts
      const postSentiments = [
        { post_id: postIds[0], sentiment: 'positive', sentiment_category: 'joy', confidence: 0.92, polarity: 0.85 },
        { post_id: postIds[1], sentiment: 'positive', sentiment_category: 'approval', confidence: 0.88, polarity: 0.72 },
        { post_id: postIds[2], sentiment: 'negative', sentiment_category: 'anger', confidence: 0.94, polarity: -0.88 },
        { post_id: postIds[3], sentiment: 'positive', sentiment_category: 'joy', confidence: 0.96, polarity: 0.91 },
        { post_id: postIds[4], sentiment: 'neutral', sentiment_category: 'neutral', confidence: 0.78, polarity: 0.05 },
        { post_id: postIds[5], sentiment: 'negative', sentiment_category: 'sadness', confidence: 0.91, polarity: -0.82 },
        { post_id: postIds[6], sentiment: 'positive', sentiment_category: 'joy', confidence: 0.89, polarity: 0.76 },
        { post_id: postIds[7], sentiment: 'positive', sentiment_category: 'joy', confidence: 0.93, polarity: 0.87 },
      ];

      for (const sentiment of postSentiments) {
        await client.query(
          `INSERT INTO sentiments (post_id, sentiment, sentiment_category, confidence, polarity, probabilities) 
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            sentiment.post_id,
            sentiment.sentiment,
            sentiment.sentiment_category,
            sentiment.confidence,
            sentiment.polarity,
            JSON.stringify({
              positive: sentiment.sentiment === 'positive' ? sentiment.confidence : (1 - sentiment.confidence) / 2,
              negative: sentiment.sentiment === 'negative' ? sentiment.confidence : (1 - sentiment.confidence) / 2,
              neutral: sentiment.sentiment === 'neutral' ? sentiment.confidence : (1 - sentiment.confidence) / 2,
            }),
          ]
        );
      }

      // Create comments with realistic interactions
      const comments = [
        // Post 0 (Tech announcement) - positive reactions
        { post_id: postIds[0], user_id: userIds[1], content: 'This looks amazing! Can\'t wait to try it out!' },
        { post_id: postIds[0], user_id: userIds[2], content: 'Finally! We\'ve been waiting for this for so long.' },
        { post_id: postIds[0], user_id: userIds[3], content: 'Congratulations on the launch! This is groundbreaking.' },
        { post_id: postIds[0], user_id: userIds[4], content: 'When will it be available in Europe?' },
        
        // Post 1 (Community support) - positive/empathetic
        { post_id: postIds[1], user_id: userIds[0], content: 'So proud of our community! Thank you to everyone who helped.' },
        { post_id: postIds[1], user_id: userIds[5], content: 'This is what humanity is all about. Beautiful story.' },
        { post_id: postIds[1], user_id: userIds[6], content: 'How can we contribute? Is there a donation link?' },
        
        // Post 2 (Bad restaurant) - negative/sympathetic
        { post_id: postIds[2], user_id: userIds[1], content: 'OMG I had the same experience last week! Never going back.' },
        { post_id: postIds[2], user_id: userIds[3], content: 'That\'s terrible! Did you speak to the manager?' },
        { post_id: postIds[2], user_id: userIds[7], content: 'Sorry you had such a bad time. Try the Italian place across the street instead!' },
        { post_id: postIds[2], user_id: userIds[4], content: 'Disappointed to hear this. They used to be so good.' },
        { post_id: postIds[2], user_id: userIds[5], content: 'Thanks for the warning! Was planning to go there this weekend.' },
        
        // Post 3 (Sports game) - enthusiastic
        { post_id: postIds[3], user_id: userIds[0], content: 'BEST. GAME. EVER! 🏆' },
        { post_id: postIds[3], user_id: userIds[2], content: 'That final play was absolutely insane!' },
        { post_id: postIds[3], user_id: userIds[6], content: 'I was there in person and the energy was unbelievable!' },
        
        // Post 4 (Music festival) - mixed reactions
        { post_id: postIds[4], user_id: userIds[1], content: 'Prices seem a bit high this year...' },
        { post_id: postIds[4], user_id: userIds[4], content: 'Already got my tickets! Who else is going?' },
        { post_id: postIds[4], user_id: userIds[7], content: 'Looking forward to it! Great lineup this year.' },
        
        // Post 5 (Environmental crisis) - concerned/angry
        { post_id: postIds[5], user_id: userIds[2], content: 'This is absolutely heartbreaking. We need urgent action!' },
        { post_id: postIds[5], user_id: userIds[3], content: 'Why isn\'t this getting more media coverage?! So frustrated.' },
        { post_id: postIds[5], user_id: userIds[5], content: 'What can individuals do to help? Please share resources.' },
        { post_id: postIds[5], user_id: userIds[6], content: 'The future of our planet is at stake. This makes me so sad.' },
        
        // Post 6 (Comedy) - excited
        { post_id: postIds[6], user_id: userIds[0], content: 'Marking my calendar! Your last special was hilarious!' },
        { post_id: postIds[6], user_id: userIds[4], content: 'Can\'t wait! Need some good laughs right now.' },
        
        // Post 7 (Marathon) - supportive
        { post_id: postIds[7], user_id: userIds[1], content: 'Congratulations! That\'s an incredible achievement!' },
        { post_id: postIds[7], user_id: userIds[3], content: 'So inspiring! This motivated me to start training.' },
        { post_id: postIds[7], user_id: userIds[5], content: 'You\'re amazing! How long did you train for?' },
      ];

      const commentIds: string[] = [];
      for (const comment of comments) {
        const result = await client.query(
          'INSERT INTO comments (post_id, user_id, full_url, content) VALUES ($1, $2, $3, $4) RETURNING id',
          [comment.post_id, comment.user_id, `https://facebook.com/comment/${Math.random().toString(36).substr(2, 9)}`, comment.content]
        );
        commentIds.push(result.rows[0].id);
      }

      // Create sentiments for comments
      const commentSentimentMap = [
        // Post 0 comments
        { sentiment: 'positive', category: 'joy', confidence: 0.95, polarity: 0.9 },
        { sentiment: 'positive', category: 'approval', confidence: 0.91, polarity: 0.85 },
        { sentiment: 'positive', category: 'joy', confidence: 0.94, polarity: 0.88 },
        { sentiment: 'neutral', category: 'curiosity', confidence: 0.82, polarity: 0.15 },
        // Post 1 comments
        { sentiment: 'positive', category: 'approval', confidence: 0.93, polarity: 0.87 },
        { sentiment: 'positive', category: 'love', confidence: 0.89, polarity: 0.83 },
        { sentiment: 'positive', category: 'curiosity', confidence: 0.76, polarity: 0.45 },
        // Post 2 comments
        { sentiment: 'negative', category: 'anger', confidence: 0.92, polarity: -0.86 },
        { sentiment: 'negative', category: 'surprise', confidence: 0.81, polarity: -0.65 },
        { sentiment: 'positive', category: 'caring', confidence: 0.84, polarity: 0.52 },
        { sentiment: 'negative', category: 'sadness', confidence: 0.78, polarity: -0.62 },
        { sentiment: 'neutral', category: 'gratitude', confidence: 0.72, polarity: 0.35 },
        // Post 3 comments
        { sentiment: 'positive', category: 'joy', confidence: 0.98, polarity: 0.95 },
        { sentiment: 'positive', category: 'excitement', confidence: 0.96, polarity: 0.92 },
        { sentiment: 'positive', category: 'joy', confidence: 0.94, polarity: 0.89 },
        // Post 4 comments
        { sentiment: 'negative', category: 'annoyance', confidence: 0.74, polarity: -0.48 },
        { sentiment: 'positive', category: 'joy', confidence: 0.88, polarity: 0.76 },
        { sentiment: 'positive', category: 'optimism', confidence: 0.86, polarity: 0.71 },
        // Post 5 comments
        { sentiment: 'negative', category: 'sadness', confidence: 0.93, polarity: -0.88 },
        { sentiment: 'negative', category: 'anger', confidence: 0.91, polarity: -0.85 },
        { sentiment: 'neutral', category: 'curiosity', confidence: 0.79, polarity: 0.22 },
        { sentiment: 'negative', category: 'sadness', confidence: 0.89, polarity: -0.79 },
        // Post 6 comments
        { sentiment: 'positive', category: 'joy', confidence: 0.92, polarity: 0.86 },
        { sentiment: 'positive', category: 'optimism', confidence: 0.87, polarity: 0.74 },
        // Post 7 comments
        { sentiment: 'positive', category: 'joy', confidence: 0.95, polarity: 0.91 },
        { sentiment: 'positive', category: 'admiration', confidence: 0.93, polarity: 0.88 },
        { sentiment: 'positive', category: 'curiosity', confidence: 0.85, polarity: 0.68 },
      ];

      for (let i = 0; i < commentIds.length; i++) {
        const sentiment = commentSentimentMap[i];
        await client.query(
          `INSERT INTO sentiments (comment_id, sentiment, sentiment_category, confidence, polarity, probabilities) 
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            commentIds[i],
            sentiment.sentiment,
            sentiment.category,
            sentiment.confidence,
            sentiment.polarity,
            JSON.stringify({
              positive: sentiment.sentiment === 'positive' ? sentiment.confidence : (1 - sentiment.confidence) / 2,
              negative: sentiment.sentiment === 'negative' ? sentiment.confidence : (1 - sentiment.confidence) / 2,
              neutral: sentiment.sentiment === 'neutral' ? sentiment.confidence : (1 - sentiment.confidence) / 2,
            }),
          ]
        );
      }

      // Create reactions
      const reactions = [
        // Post 0 - tech announcement
        { user_id: userIds[0], post_id: postIds[0], reaction_type: 'like' },
        { user_id: userIds[1], post_id: postIds[0], reaction_type: 'love' },
        { user_id: userIds[2], post_id: postIds[0], reaction_type: 'wow' },
        { user_id: userIds[5], post_id: postIds[0], reaction_type: 'like' },
        { user_id: userIds[6], post_id: postIds[0], reaction_type: 'like' },
        
        // Post 1 - community support
        { user_id: userIds[1], post_id: postIds[1], reaction_type: 'love' },
        { user_id: userIds[2], post_id: postIds[1], reaction_type: 'love' },
        { user_id: userIds[3], post_id: postIds[1], reaction_type: 'love' },
        { user_id: userIds[4], post_id: postIds[1], reaction_type: 'love' },
        
        // Post 2 - bad restaurant
        { user_id: userIds[0], post_id: postIds[2], reaction_type: 'sad' },
        { user_id: userIds[2], post_id: postIds[2], reaction_type: 'angry' },
        { user_id: userIds[6], post_id: postIds[2], reaction_type: 'sad' },
        
        // Post 3 - sports game
        { user_id: userIds[1], post_id: postIds[3], reaction_type: 'love' },
        { user_id: userIds[3], post_id: postIds[3], reaction_type: 'wow' },
        { user_id: userIds[4], post_id: postIds[3], reaction_type: 'like' },
        { user_id: userIds[5], post_id: postIds[3], reaction_type: 'like' },
        { user_id: userIds[7], post_id: postIds[3], reaction_type: 'love' },
        
        // Post 5 - environmental
        { user_id: userIds[0], post_id: postIds[5], reaction_type: 'sad' },
        { user_id: userIds[1], post_id: postIds[5], reaction_type: 'sad' },
        { user_id: userIds[4], post_id: postIds[5], reaction_type: 'angry' },
        
        // Post 6 - comedy
        { user_id: userIds[2], post_id: postIds[6], reaction_type: 'haha' },
        { user_id: userIds[3], post_id: postIds[6], reaction_type: 'haha' },
        { user_id: userIds[5], post_id: postIds[6], reaction_type: 'love' },
        
        // Post 7 - marathon
        { user_id: userIds[0], post_id: postIds[7], reaction_type: 'love' },
        { user_id: userIds[2], post_id: postIds[7], reaction_type: 'wow' },
        { user_id: userIds[4], post_id: postIds[7], reaction_type: 'like' },
        { user_id: userIds[6], post_id: postIds[7], reaction_type: 'love' },
        
        // Some comment reactions
        { user_id: userIds[0], comment_id: commentIds[0], reaction_type: 'like' },
        { user_id: userIds[3], comment_id: commentIds[1], reaction_type: 'like' },
        { user_id: userIds[2], comment_id: commentIds[5], reaction_type: 'love' },
        { user_id: userIds[4], comment_id: commentIds[12], reaction_type: 'wow' },
        { user_id: userIds[6], comment_id: commentIds[7], reaction_type: 'sad' },
      ];

      for (const reaction of reactions) {
        await client.query(
          'INSERT INTO reactions (user_id, post_id, comment_id, reaction_type) VALUES ($1, $2, $3, $4)',
          [reaction.user_id, reaction.post_id || null, reaction.comment_id || null, reaction.reaction_type]
        );
      }

      await client.query('COMMIT');

      // Get summary statistics
      const stats = {
        users: userIds.length,
        posts: postIds.length,
        comments: commentIds.length,
        sentiments: postSentiments.length + commentSentimentMap.length,
        reactions: reactions.length,
      };

      return {
        success: true,
        message: 'Database seeded successfully',
        stats,
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async clearDatabase(): Promise<any> {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      await client.query('DELETE FROM reactions');
      await client.query('DELETE FROM sentiments');
      await client.query('DELETE FROM comments');
      await client.query('DELETE FROM posts');
      await client.query('DELETE FROM users WHERE id NOT IN (SELECT id FROM auth_users)');
      
      await client.query('COMMIT');

      return {
        success: true,
        message: 'Database cleared successfully',
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}
