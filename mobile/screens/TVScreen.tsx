import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function TVScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>TV Screen</Text>
      <Text style={styles.subtext}>(Host a room and play videos here)</Text>
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
