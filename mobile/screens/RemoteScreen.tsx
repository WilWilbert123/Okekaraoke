import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function RemoteScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Remote Screen</Text>
      <Text style={styles.subtext}>(Join a room and queue songs here)</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  subtext: {
    color: '#aaa',
    marginTop: 10,
  }
});
