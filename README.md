# Contacts Layer - AI-Powered Contact Search 👋

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## Features

- AI-powered contact search and ranking
- Automatic hashtag extraction from contact names using OpenAI (direct API calls, React Native compatible)
  - Company names (e.g., `#google`, `#meta`, `#airbnb`)
  - Job roles (e.g., `#engineer`, `#pm`, `#designer`)
  - Places/Events (e.g., `#conference`, `#hackathon`, `#ycombinator`)
  - Professional context (e.g., `#friend`, `#linkedin`)
  - Location based on area codes (e.g., `#atlanta`, `#nyc`, `#sf`)
- Smart contact organization with hashtags
- Robust fallback hashtag extraction (works without API key)

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Set up environment variables

   Create a `.env` file in the root directory:
   ```bash
   OPENAI_API_KEY=your_openai_api_key_here
   ```

   Get your OpenAI API key from [OpenAI Platform](https://platform.openai.com/api-keys)

3. Start the app

   ```bash
   npx expo start
   ```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Technical Notes

### Why Direct API Calls Instead of LangChain?

This project uses **direct fetch calls to the OpenAI API** instead of LangChain because:

1. **React Native Compatibility**: LangChain is designed for Node.js and depends on Node.js-specific modules (`crypto`, `uuid`, etc.) that don't exist in React Native's JavaScript environment
2. **Bundle Size**: Direct API calls are much lighter than including the entire LangChain library
3. **Error Prevention**: Avoids "Cannot read properties of undefined" errors from missing Node.js modules
4. **Performance**: Simpler implementation with less overhead

The implementation still provides the same AI-powered hashtag extraction functionality.

## Usage Examples

### Extracting Hashtags from a Contact

```typescript
import { getInitialHashtags } from './utils/aiRankingContacts';

const contact = {
  id: '1',
  name: 'Sam Airbnb Eng',
  phoneNumber: '+1 (555) 901-2346',
  email: 'samuel.j@airbnb.com'
};

// Extract hashtags using AI (or fallback if no API key)
const contactWithHashtags = await getInitialHashtags(contact);
console.log(contactWithHashtags.hashtags);
// Example output: ['#airbnb', '#engineer', '#tech']
```

### Contact Name Format Examples

The AI understands various contact name formats commonly used by people who network:

- `"Alice Google PM"` → `#google`, `#pm`, `#productmanager`
- `"Sam Airbnb Eng"` → `#airbnb`, `#engineer`
- `"Patricia YC Demo Day"` → `#yc`, `#ycombinator`, `#demoday`, `#startup`
- `"Charlie Mikes Friend"` → `#friend`, `#personal`
- `"Laura Tech Conference"` → `#conference`, `#event`

## Get a fresh project

When you're ready, run:

```bash
npm run reset-project
```

This command will move the starter code to the **app-example** directory and create a blank **app** directory where you can start developing.

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.
