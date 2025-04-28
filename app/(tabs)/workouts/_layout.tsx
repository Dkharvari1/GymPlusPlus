import { Stack } from 'expo-router';
export default function WorkoutsStack(){
  return(
    <Stack screenOptions={{
      headerShown:true,
      headerTintColor:'#fff',
      headerStyle:{backgroundColor:'#4f46e5'}
    }}>
      <Stack.Screen name="index"     options={{title:'My Plan'}}/>
      <Stack.Screen name="explore"   options={{title:'Explore Exercises'}}/>
      <Stack.Screen name="[id]"      options={{title:'Exercise'}}/>
      <Stack.Screen name="recommend" options={{title:'Recommend by Body Part'}}/>
    </Stack>
  )
}
