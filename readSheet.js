import { google } from 'googleapis';

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
    throw new Error('X_REPLIT_TOKEN not found for repl/depl');
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
  oauth2Client.setCredentials({
    access_token: accessToken
  });

  return google.sheets({ version: 'v4', auth: oauth2Client });
}

async function listSpreadsheets() {
  const accessToken = await getAccessToken();
  
  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({
    access_token: accessToken
  });
  
  const drive = google.drive({ version: 'v3', auth: oauth2Client });
  
  const response = await drive.files.list({
    q: "mimeType='application/vnd.google-apps.spreadsheet'",
    fields: 'files(id, name)',
    pageSize: 20
  });
  
  return response.data.files;
}

async function readSheetData(spreadsheetId, range = 'Sheet1') {
  const sheets = await getUncachableGoogleSheetClient();
  
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range,
  });
  
  return response.data.values;
}

async function main() {
  try {
    const SPREADSHEET_ID = '1TltvjddWYgptIwIKLfXj9FVVQpmt5q3J4KUm3c0l_Rw';
    const SHEET_NAME = 'Base';
    
    console.log(`Reading data from spreadsheet ID: ${SPREADSHEET_ID}`);
    console.log(`Sheet name: ${SHEET_NAME}\n`);
    
    const data = await readSheetData(SPREADSHEET_ID, SHEET_NAME);
    
    if (!data || data.length === 0) {
      console.log('No data found in the sheet.');
      return;
    }
    
    console.log('=== COLUMN HEADERS ===');
    console.log(data[0]);
    
    console.log(`\n=== TOTAL ROWS: ${data.length - 1} (excluding header) ===`);
    
    console.log('\n=== FIRST 5 DATA ROWS ===');
    for (let i = 1; i <= Math.min(5, data.length - 1); i++) {
      console.log(`\nRow ${i}:`);
      data[0].forEach((header, idx) => {
        console.log(`  ${header}: ${data[i][idx] || '(empty)'}`);
      });
    }
    
  } catch (error) {
    console.error('Error:', error.message);
    console.error(error.stack);
  }
}

main();
