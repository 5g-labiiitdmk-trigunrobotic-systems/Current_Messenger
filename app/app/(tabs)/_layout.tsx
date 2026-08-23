import React from 'react';
import { Tabs } from 'expo-router/tabs';
import { TabBar } from '../../src/components/TabBar';

// FILE PURPOSE: Expo Router layout for the "(tabs)" route group — the
// main signed-in app's four-tab bottom navigation (Chats, Calls,
// Contacts, Profile). Supplies this app's own custom TabBar component in
// place of the default tab bar UI.
export default function TabsLayout() {
  return (
    <Tabs tabBar={(props) => <TabBar {...props} />} screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="chats" />
      <Tabs.Screen name="calls" />
      <Tabs.Screen name="contacts" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}
