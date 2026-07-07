import React from 'react';
import { Tabs } from 'expo-router/tabs';
import { TabBar } from '../../src/components/TabBar';

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
