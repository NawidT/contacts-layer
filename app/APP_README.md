# Contacts Layer App

An iPhone app built with Expo that provides AI-powered contact search and ranking functionality.

## Features

- 📱 **Contact Permissions**: Requests permission to access device contacts on iOS
- 👥 **Pre-loaded Contacts**: Comes with 26 mock contacts for testing
- 🔍 **Smart Search**: Search bar at the bottom of the screen for easy access
- 🤖 **AI Ranking**: Ranks contacts based on search relevance (currently using alphabetical ordering as a mock implementation)
- 📊 **Limited Results**: Shows a maximum of 20 contacts at a time
- 💾 **In-Memory Cache**: Stores contacts in internal memory cache

## Project Structure

```
app/
├── app/
│   ├── index.tsx              # Main app screen with contact list and search
│   └── _layout.tsx            # App layout configuration
├── types/
│   └── contact.ts             # TypeScript interface for Contact
├── data/
│   └── mockContacts.ts        # Pre-loaded mock contact data (26 contacts)
├── utils/
│   └── aiRankingContacts.ts   # AI ranking algorithm (mock with alphabetical)
└── app.json                   # App configuration with permissions
```

## How It Works

1. **On App Launch**: The app requests permission to access contacts and displays the first 20 contacts in alphabetical order
2. **Search**: Type a query in the search bar at the bottom and tap "Search" or press return
3. **AI Ranking**: The app filters and ranks contacts based on the search query:
   - Matches against name, phone number, or email
   - Currently sorts results alphabetically (placeholder for future AI implementation)
   - Returns up to 20 most relevant contacts

## Running the App

```bash
# Navigate to the app directory
cd app

# Start the development server
npm start

# Run on iOS
npm run ios

# Run on Android
npm run android
```

## Future Enhancements

- Replace mock AI ranking with actual AI-powered relevance scoring
- Load real contacts from device when permission is granted
- Add contact detail view
- Implement real-time search (as you type)
- Add contact grouping and categories
- Persist search history

## Permissions

- **iOS**: `NSContactsUsageDescription` - "This app needs access to your contacts to display and search through them."
- **Android**: `READ_CONTACTS` permission

## Dependencies

- `expo` - Core Expo SDK
- `expo-contacts` - Contact permissions and access
- `react-native` - React Native framework
- `expo-router` - File-based routing


