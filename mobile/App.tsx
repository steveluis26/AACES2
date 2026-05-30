import React, { useEffect } from 'react'
import { NavigationContainer } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { StatusBar } from 'expo-status-bar'
import { useSync } from './services/syncService'
import { useAppStore } from './stores/appStore'

// Screens
import BusinessSetupScreen from './screens/BusinessSetupScreen'
import RetailPosScreen from './screens/retail/RetailPosScreen'
import RestaurantPosScreen from './screens/restaurant/RestaurantPosScreen'
import SchoolScreen from './screens/school/SchoolScreen'
import MedicalScreen from './screens/medical/MedicalScreen'

export type RootStackParamList = {
  BusinessSetup: undefined
  RetailPOS: undefined
  RestaurantPOS: undefined
  School: undefined
  Medical: undefined
}

const Stack = createNativeStackNavigator<RootStackParamList>()

export default function App() {
  const { currentBusiness } = useAppStore()
  const { startSync, stopSync } = useSync()

  useEffect(() => {
    // Iniciar sincronización automática
    startSync()
    
    return () => {
      stopSync()
    }
  }, [])

  const getInitialRoute = () => {
    if (!currentBusiness) {
      return 'BusinessSetup'
    }
    
    switch (currentBusiness.sector) {
      case 'retail':
        return 'RetailPOS'
      case 'restaurant':
        return 'RestaurantPOS'
      case 'school':
        return 'School'
      case 'medical':
        return 'Medical'
      default:
        return 'BusinessSetup'
    }
  }

  return (
    <NavigationContainer>
      <StatusBar style="auto" />
      <Stack.Navigator
        initialRouteName={getInitialRoute()}
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right'
        }}
      >
        <Stack.Screen name="BusinessSetup" component={BusinessSetupScreen} />
        <Stack.Screen name="RetailPOS" component={RetailPosScreen} />
        <Stack.Screen name="RestaurantPOS" component={RestaurantPosScreen} />
        <Stack.Screen name="School" component={SchoolScreen} />
        <Stack.Screen name="Medical" component={MedicalScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  )
}