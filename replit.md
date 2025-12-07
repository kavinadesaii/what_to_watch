# What Should I Watch?

A movie and TV show recommendation web app that helps users discover their next binge through a series of preference questions.

## Overview

This is a single-page web application that connects to a PostgreSQL database of 378 movies/series. Users answer 4 questions about their viewing preferences and receive personalized recommendations from the database.

## How It Works

1. **Welcome Screen** - Animated background with movie posters, invites users to start
2. **Question 1: Time** - How much time do you have? (quick/proper watch/binge)
3. **Question 2: Mood** - What do you want the content to do? (multiple choice)
4. **Question 3: Content Type** - Movie or Series preference
5. **Question 4: Language** - Language preference (English, Hindi, Regional, Any)
6. **Recommendations** - Shows 3 personalized recommendations with option to get more

## Project Structure

- `index.html` - Main application with all screens and JavaScript logic
- `server.js` - Node.js/Express backend API on port 5000
- `setupDatabase.js` - Database setup and import script
- `readSheet.js` - Google Sheet reading utility
- `stitch_welcome_what_should_i_watch/` - Original design files

## Technologies Used

- Node.js with Express
- PostgreSQL database
- Tailwind CSS (via CDN)
- Vanilla JavaScript
- Google Sheets API integration

## Database Schema

The `movies` table contains:
- id, name, type, summary, language, genre, family_safe, platform, time_category, poster_url, mood_tags

## API Endpoint

**GET /api/recommendations**
- Query params: `time`, `moods`, `contentType`, `languages`, `exclude`
- Returns 3 random matching movies based on filters

## Data Source

Movie data imported from Google Sheet (ID: `1TltvjddWYgptIwIKLfXj9FVVQpmt5q3J4KUm3c0l_Rw`, Sheet: `Base`)

## Running the App

The app runs on port 5000 using the Node.js Express server with cache control headers.
