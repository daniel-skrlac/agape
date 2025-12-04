// const Colors = {
//   // Brand Colors
//   primary: '#2563EB',      // Vibrant Blue - main actions, CTA
//   secondary: '#8B5CF6',    // Purple - secondary actions, accents
//   accent1: '#06B6D4',      // Cyan - success states, progress, growth
//   accent2: '#FB923C',      // Orange - highlights, notifications, warmth
  
//   // Functional Colors
//   success: '#10B981',
//   warning: '#F59E0B',
//   error: '#EF4444',
//   info: '#06B6D4',
  
//   // Neutral Palette
//   gray: {
//     50: '#F9FAFB',
//     100: '#F3F4F6',
//     200: '#E5E7EB',
//     300: '#D1D5DB',
//     400: '#9CA3AF',
//     500: '#6B7280',
//     600: '#4B5563',
//     700: '#374151',
//     800: '#1F2937',
//     900: '#111827', 
//   },

//   white: '#FFFFFF',
//   black: '#000000',
//   offWhite: '#F5F5F5',
//   offBlack: '#181616ff',
  
//   // Theme-specific colors
//   light: {
//     // Text
//     text: '#4B5563',           // gray-600
//     textSecondary: '#9CA3AF',  // gray-400
//     textHeading: '#374151',    // gray-700
    
//     // Backgrounds
//     background: '#F5F5F5',
//     backgroundSecondary: '#F9FAFB',
//     backgroundCard: '#FFFFFF',
    
//     // UI Elements
//     border: '#E5E7EB',         // gray-200
//     borderLight: '#F3F4F6',    // gray-100
//     divider: '#E5E7EB',
    
//     // Interactive
//     tint: '#2563EB',
//     link: '#2563EB', 
//     buttonPrimary: '#2563EB',
//     buttonSecondary: '#8B5CF6',
    
//     // Tab Navigation
//     tabIconDefault: '#9CA3AF',
//     tabIconSelected: '#2563EB',
//     tabBarBackground: '#FFFFFF',
    
//     // Input
//     inputBackground: '#F9FAFB',
//     inputBorder: '#E5E7EB',
//     inputPlaceholder: '#9CA3AF',
//     inputText: '#4B5563',
    
//     // Shadow (for elevation)
//     shadow: 'rgba(0, 0, 0, 0.1)',
//   },
  
//   dark: {
//     // Text
//     text: '#F9FAFB',
//     textSecondary: '#9CA3AF', 
//     textHeading: '#FFFFFF',
    
//     // Backgrounds
//     background: '#111827',
//     backgroundSecondary: '#1F2937', 
//     backgroundCard: '#1F2937',
    
//     // UI Elements
//     border: '#374151', 
//     borderLight: '#4B5563',
//     divider: '#374151',
    
//     // Interactive
//     tint: '#8B5CF6',
//     link: '#60A5FA',
//     buttonPrimary: '#8B5CF6',
//     buttonSecondary: '#06B6D4',
    
//     // Tab Navigation
//     tabIconDefault: '#6B7280',
//     tabIconSelected: '#8B5CF6',
//     tabBarBackground: '#1F2937',
    
//     // Input
//     inputBackground: '#1F2937',
//     inputBorder: '#374151',
//     inputPlaceholder: '#6B7280',
//     inputText: '#F9FAFB',
    
//     // Shadow (for elevation)
//     shadow: 'rgba(0, 0, 0, 0.3)',
//   },
// };

// export default Colors;
// constants/Colors.ts
const tintColor = "#E74916";

export default {
  light: {
    text: "#111827",
    background: "#FFFFFF",
    tint: tintColor,
    inputBackground: "#F3F4F6",
    inputBorder: "#E5E7EB",
    inputPlaceholder: "#9CA3AF",
    error: "#DC2626",
  },
  dark: {
    text: "#F9FAFB",
    background: "#000000",
    tint: tintColor,
    inputBackground: "#1F2933",
    inputBorder: "#4B5563",
    inputPlaceholder: "#6B7280",
    error: "#F87171",
  },
  tintColor,
};
