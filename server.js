import express from 'express';
import cors from 'cors';
import pg from 'pg';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

app.use((req, res, next) => {
  res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  next();
});

const TIME_MAP = {
  'quick': 'Something quick (20-30 mins)',
  'proper': 'One proper watch (40–120 mins)',
  'binge': 'Long binge session (2+ hours)'
};

const MOOD_MAP = {
  'laugh': 'Make me laugh',
  'feel-good': 'Make me feel good',
  'hooked': 'Keep me hooked',
  'emotional': 'Emotional & dramatic',
  'mind-blow': 'Blow my mind',
  'learn': 'Learn something',
  'dark': 'Ready for something dark'
};

app.get('/api/recommendations', async (req, res) => {
  try {
    console.log("Incoming query params:", req.query);
    const { time, moods, contentType, languages, eras, exclude } = req.query;
    
    let query = 'SELECT * FROM movies WHERE 1=1';
    const params = [];
    let paramIndex = 1;
    
    if (time && TIME_MAP[time]) {
      query += ` AND time_category = $${paramIndex}`;
      params.push(TIME_MAP[time]);
      paramIndex++;
    }
    
    if (moods) {
      const moodArray = moods.split(',');
      const moodConditions = [];
      for (const mood of moodArray) {
        if (MOOD_MAP[mood]) {
          moodConditions.push(`mood_tags ILIKE $${paramIndex}`);
          params.push(`%${MOOD_MAP[mood]}%`);
          paramIndex++;
        }
      }
      if (moodConditions.length > 0) {
        query += ` AND (${moodConditions.join(' OR ')})`;
      }
    }
    
    if (contentType && contentType !== 'any') {
      if (contentType === 'movie') {
        query += ` AND type = $${paramIndex}`;
        params.push('Movie');
        paramIndex++;
      } else if (contentType === 'series') {
        query += ` AND type = $${paramIndex}`;
        params.push('Series');
        paramIndex++;
      }
    }
    
    if (languages && languages !== 'any') {
      const langArray = languages.split(',').filter(l => l !== 'any');
      if (langArray.length > 0) {
        const langConditions = [];
        for (const lang of langArray) {
          if (lang === 'english') {
            langConditions.push(`language ILIKE $${paramIndex}`);
            params.push('%English%');
            paramIndex++;
          } else if (lang === 'hindi') {
            langConditions.push(`language ILIKE $${paramIndex}`);
            params.push('%Hindi%');
            paramIndex++;
          } else if (lang === 'regional') {
            langConditions.push(`(language NOT ILIKE '%English%' AND language NOT ILIKE '%Hindi%')`);
          }
        }
        if (langConditions.length > 0) {
          query += ` AND (${langConditions.join(' OR ')})`;
        }
      }
    }
    
    if (exclude) {
      const excludeIds = exclude.split(',').map(id => parseInt(id)).filter(id => !isNaN(id));
      if (excludeIds.length > 0) {
        query += ` AND id NOT IN (${excludeIds.map((_, i) => `$${paramIndex + i}`).join(', ')})`;
        params.push(...excludeIds);
        paramIndex += excludeIds.length;
      }
    }
    // Era filter (Retro / Millennials / Gen Z)
    // Filter 5: era/year ranges
    if (eras) {
      const eraArray = eras.split(',').map(e => e.trim());
      const eraConditions = [];

      for (const era of eraArray) {
        if (era === 'retro') {
          // Retro / old: before 2000
          eraConditions.push(`year < $${paramIndex}`);
          params.push(2000);
          paramIndex++;
        } else if (era === 'millennial') {
          // Millennials' choices: 2000–2020
          eraConditions.push(`(year >= $${paramIndex} AND year <= $${paramIndex + 1})`);
          params.push(2000, 2020);
          paramIndex += 2;
        } else if (era === 'genz') {
          // Gen Z: after 2020
          eraConditions.push(`year > $${paramIndex}`);
          params.push(2020);
          paramIndex++;
        }
      }

      if (eraConditions.length > 0) {
        query += ` AND (${eraConditions.join(' OR ')})`;
      }
    }

  
    query += ' ORDER BY RANDOM() LIMIT 3';
    
    console.log('Final recommendation query:', query);
    console.log('With params:', params);
    
    const result = await pool.query(query, params);

    
    
    const movies = result.rows.map(row => ({
      id: row.id,
      name: row.name,
      type: row.type,
      summary: row.summary,
      language: row.language,
      genre: row.genre,
      familySafe: row.family_safe,
      platform: row.platform,
      timeCategory: row.time_category,
      posterUrl: row.poster_url,
      moodTags: row.mood_tags
    }));
    
    res.json({ 
      success: true, 
      movies,
      count: movies.length,
      totalMatches: result.rowCount
    });
    
  } catch (error) {
    console.error('Error fetching recommendations:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch recommendations',
      movies: []
    });
  }
});

app.get('/api/stats', async (req, res) => {
  try {
    const countResult = await pool.query('SELECT COUNT(*) FROM movies');
    const typesResult = await pool.query('SELECT type, COUNT(*) FROM movies GROUP BY type');
    
    res.json({
      totalMovies: parseInt(countResult.rows[0].count),
      byType: typesResult.rows
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

app.get('/', (req, res) => {
  res.sendFile(join(__dirname, 'index.html'));
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
});

