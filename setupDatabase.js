import pg from 'pg';
import fetch from 'node-fetch';

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function readSheetData(spreadsheetId, range) {
  // Read from public Google Sheet (no auth needed)
  const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:json&sheet=${range}`;
  
  const response = await fetch(url);
  const text = await response.text();
  
  // Parse Google's JSONP response
  const jsonText = text.substring(47).slice(0, -2);
  const data = JSON.parse(jsonText);
  
  // Convert to array format
  const rows = data.table.rows.map(row => 
    row.c.map(cell => cell?.v || '')
  );
  
  return rows;
}

async function setupDatabase() {
  const client = await pool.connect();
  
  try {
    console.log('Creating movies table...');
    
    await client.query(`
      DROP TABLE IF EXISTS movies CASCADE;
    `);
    
    await client.query(`
      CREATE TABLE movies (
        id SERIAL PRIMARY KEY,
        name VARCHAR(500) NOT NULL,
        type VARCHAR(50),
        summary TEXT,
        language VARCHAR(500),
        genre VARCHAR(500),
        family_safe VARCHAR(10),
        platform VARCHAR(200),
        time_category VARCHAR(100),
        poster_url TEXT,
        year INTEGER,
        mood_tags TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    console.log('Table created successfully!');
    
    console.log('\nFetching data from Google Sheets...');
    const SPREADSHEET_ID = '1TltvjddWYgptIwIKLfXj9FVVQpmt5q3J4KUm3c0l_Rw';
    const SHEET_NAME = 'Base';
    
    const data = await readSheetData(SPREADSHEET_ID, SHEET_NAME);
    
    if (!data || data.length <= 1) {
      console.log('No data found in sheet');
      return;
    }
    
    console.log(`Found ${data.length - 1} movies to import`);
    
    let imported = 0;
    let errors = 0;
    
    // Skip header row (index 0)
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      
      try {
        await client.query(`
          INSERT INTO movies (
            name, 
            type, 
            summary, 
            language, 
            genre, 
            family_safe, 
            platform, 
            time_category, 
            poster_url, 
            year,
            mood_tags
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        `, [
          row[0] || '',
          row[1] || '',
          row[2] || '',
          row[3] || '',
          row[4] || '',
          row[5] || '',
          row[6] || '',
          row[7] || '',
          row[8] || '',
          row[9] ? parseInt(row[9], 10) || null : null,
          row[10] || ''
        ]);
        imported++;
        
        if (imported % 10 === 0) {
          console.log(`Imported ${imported} movies...`);
        }
      } catch (err) {
        console.error(`Error importing row ${i}: ${err.message}`);
        errors++;
      }
    }
    
    console.log(`\nImport complete!`);
    console.log(`Successfully imported: ${imported} movies`);
    console.log(`Errors: ${errors}`);
    
    const countResult = await client.query('SELECT COUNT(*) FROM movies');
    console.log(`\nTotal movies in database: ${countResult.rows[0].count}`);
    
    const sampleResult = await client.query('SELECT name, type, genre, year FROM movies LIMIT 5');
    console.log('\nSample data:');
    sampleResult.rows.forEach(row => {
      console.log(`  - ${row.name} (${row.type}, ${row.year}) - ${row.genre}`);
    });
    
  } finally {
    client.release();
  }
}

setupDatabase()
  .then(() => {
    console.log('\nDatabase setup complete!');
    process.exit(0);
  })
  .catch(err => {
    console.error('Setup failed:', err);
    process.exit(1);
  });
