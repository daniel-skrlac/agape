# agape-mobile

## Installation instructions

Frontend of Agape app is made in [React Native](https://reactnative.dev/docs/environment-setup) using [Expo](https://docs.expo.dev/get-started/start-developing/) framework for easyer and faster development. Initial setup was made so that other contributors can start making other screens and components.

**Prerequirements:**
- Node.js installed (v18 or higher)
- Install Android Studio with Android SDK (If you are using Android emulator) or install XCode on MacOS
- [Expo Go](https://play.google.com/store/apps/details?id=host.exp.exponent) mobile app (recommended for both iOS and Android preview, no Xcode or Android SDK needed)
- React native code editor (VSCode is recomended)

**Start the app**

Run following command inside `/agale-mobile` directory:
```
npx expo start --tunnel 
```
You will be provided wit QR code for Expo Go mobile app. Your phone MUST be ocnnected to the same Wi-fi network as your development laptop or PC. Scan the QR code and ap should be shown on Expo GO app.

**Folder structure**
```
agape-mobile/
├── .expo/
├── .vscode/
├── app/
│   └── (tabs)/
├── assets/
│   ├── fonts/
│   └── images/
├── components/
│   └── __tests__/
├── constants/
└── node_modules/
```

`app/` - Main application screens using Expo Router file-based routing. Each file becomes a route automatically.

`app/(tabs)/` - Tab navigation group. Contains screens that appear as tabs in bottom navigation.

`assets/ `- Static resources like images, fonts, and other media files used throughout the app.

`assets/fonts/` - Custom font files (.ttf, .otf) referenced in StyleSheet fontFamily properties.

`assets/images/` - App images, icons, graphics, and app store assets like splash screens.

`components/` - Reusable React Native components and custom hooks shared across multiple screens.

`components/__tests__/` - Unit tests for components using Jest and React Native Testing Library. (**Will not be used just jet**)

`constants/` - App-wide constants, configuration objects, colors, dimensions, and theme definitions.

### 🚀 Usage Guidelines

Development Flow:

- Screens → Add to `app/(tabs) `directory
- Reusable UI → Create in `components/`, keep components organised, use understandable names
- Static files → Place in appropriate `assets/` subdirectory
- App constants → Define in `constants/`, all strings should be defined here for easyer translation