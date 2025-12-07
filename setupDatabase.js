import pg from 'pg';
import { google } from 'googleapis';

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

let connectionSettings;

async function getAccessToken() {
  if (connectionSettings && connectionSettings.settings.expires_at && new Date(connectionSettings.settings.expires_at).getTime() > Date.now()) {
    return connectionSettings.settings.access_token;
  }
  
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found');
  }

  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=google-sheet',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  const accessToken = connectionSettings?.settings?.access_token || connectionSettings.settings?.oauth?.credentials?.access_token;

  if (!connectionSettings || !accessToken) {
    throw new Error('Google Sheet not connected');
  }
  return accessToken;
}

async function getUncachableGoogleSheetClient() {
  const accessToken = await getAccessToken();
  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({ access_token: accessToken });
  return google.sheets({ version: 'v4', auth: oauth2Client });
}

async function readSheetData(spreadsheetId, range) {
  const sheets = await getUncachableGoogleSheetClient();
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range,
  });
  return response.data.values;
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
        year INTEGER,              -- 👈 NEW
        mood_tags TEXT,            -- stays
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
    
    const headers = data[0];
    console.log(`Found ${data.length - 1} movies to import`);
    
    let imported = 0;
    let errors = 0;
    
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
          row[0] || '',              // Name
          row[1] || '',              // Type
          row[2] || '',              // Summary
          row[3] || '',              // Language
          row[4] || '',              // Genre
          row[5] || '',              // Family Safe?
          row[6] || '',              // Platform
          row[7] || '',              // Time Category
          row[8] || '',              // Poster URL
          row[9] ? parseInt(row[9], 10) || null : null,  // Year (number or null)
          row[10] || ''              // Mood Tags
        ]);
        imported++;
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
    
    const sampleResult = await client.query('SELECT name, type, time_category, mood_tags FROM movies LIMIT 3');
    console.log('\nSample data:');
    sampleResult.rows.forEach(row => {
      console.log(`  - ${row.name} (${row.type}) - ${row.time_category}`);
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
