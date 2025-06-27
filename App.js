// App.js
import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet, View, Alert, Text, TouchableOpacity,
  ActivityIndicator, Modal, TextInput, Image, Button
} from 'react-native';
import MapView, { Marker, UrlTile } from 'react-native-maps';
import * as Location from 'expo-location';
import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import { supabase } from './lib/supabaseClient';

WebBrowser.maybeCompleteAuthSession();

export default function App() {
  const [email, setEmail] = useState(null);
  const [privateSpots, setPrivateSpots] = useState([]);
  const [publicSpots, setPublicSpots] = useState([]);
  const [region, setRegion] = useState({
    latitude: 46.8139,
    longitude: -71.208,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  });
  const [location, setLocation] = useState(null);
  const [heading, setHeading] = useState(0);
  const lastHeading = useRef(0);
  const [isLoading, setIsLoading] = useState(true);

  const [modalVisible, setModalVisible] = useState(false);
  const [newSpotCoords, setNewSpotCoords] = useState(null);
  const [spotName, setSpotName] = useState('');
  const [spotDescription, setSpotDescription] = useState('');
  const [spotIsPublic, setSpotIsPublic] = useState(false);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.from('public_spots').select('*');
      if (!error) setPublicSpots(data || []);
    })();

    (async () => {
      const stored = await AsyncStorage.getItem('private_spots');
      if (stored) setPrivateSpots(JSON.parse(stored));
    })();

    (async () => {
      const storedEmail = await AsyncStorage.getItem('user_email');
      if (storedEmail) {
        const { data, error } = await supabase
          .from('users')
          .select('*')
          .eq('email', storedEmail)
          .single();

        if (!error && data) {
          setEmail(storedEmail);
        } else {
          await AsyncStorage.removeItem('user_email');
        }
      }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission refusée', 'La localisation est nécessaire.');
        return;
      }

      const loc = await Location.getCurrentPositionAsync({});
      setLocation(loc.coords);
      setRegion({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      });

      Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, distanceInterval: 1 },
        (loc) => setLocation(loc.coords)
      );

      Location.watchHeadingAsync((headingObj) => {
        const newHeading = headingObj.trueHeading;
        let diff = newHeading - lastHeading.current;
        if (diff > 180) diff -= 360;
        if (diff < -180) diff += 360;
        const smoothed = lastHeading.current + diff * 0.2;
        const normalized = (smoothed + 360) % 360;
        lastHeading.current = normalized;
        setHeading(normalized);
      });

      setIsLoading(false);
    })();
  }, []);

  const handleLogin = async () => {
    const redirectUri = AuthSession.makeRedirectUri({ useProxy: true });
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: redirectUri }
    });

    if (error) return Alert.alert('Erreur de login', error.message);

    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUri);
    if (result.type === 'success' && result.url.includes('access_token')) {
      const sessionRes = await supabase.auth.getSession();
      const userEmail = sessionRes.data.session?.user?.email;
      if (userEmail) {
        await AsyncStorage.setItem('user_email', userEmail);
        await supabase.from('users').upsert({ email: userEmail });
        setEmail(userEmail);
      }
    }
  };

  const saveNewSpot = async () => {
    if (!newSpotCoords) return;

    const spot = {
      name: spotName.trim() || (spotIsPublic ? 'Spot public' : 'Spot privé'),
      description: spotDescription.trim(),
      latitude: newSpotCoords.latitude,
      longitude: newSpotCoords.longitude,
    };

    try {
      if (spotIsPublic) {
        if (!email) {
          Alert.alert('Connexion requise', 'Veuillez vous connecter.');
          return;
        }
        const { error } = await supabase.from('public_spots').insert([{ ...spot, email }]);
        if (error) throw error;
        const { data } = await supabase.from('public_spots').select('*');
        setPublicSpots(data);
      } else {
        const updated = [...privateSpots, spot];
        setPrivateSpots(updated);
        await AsyncStorage.setItem('private_spots', JSON.stringify(updated));
      }
      setModalVisible(false);
    } catch (e) {
      Alert.alert('Erreur', "Impossible d'ajouter le spot.");
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loaderContainer}>
        <Image source={require('./assets/logo.png')} style={styles.logo} />
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text style={{ marginTop: 10 }}>Chargement...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MapView style={styles.map} region={region} onPress={e => setNewSpotCoords(e.nativeEvent.coordinate)}>
        <UrlTile urlTemplate="https://a.tile.openstreetmap.org/{z}/{x}/{y}.png" maximumZ={19} />
        {location && (
          <Marker coordinate={location} anchor={{ x: 0.5, y: 0.5 }} flat rotation={heading}>
            <View style={styles.userMarker}>
              <View style={styles.outerCircle}>
                <MaterialIcons name="navigation" size={24} color="white" />
              </View>
            </View>
          </Marker>
        )}
        {privateSpots.map((s, i) => <Marker key={`p-${i}`} coordinate={s} title={s.name} description={s.description} pinColor="red" />)}
        {publicSpots.map((s, i) => <Marker key={`pub-${i}`} coordinate={s} title={s.name} description={s.description} pinColor="green" />)}
      </MapView>

      {!email && (
        <TouchableOpacity style={styles.loginButton} onPress={handleLogin}>
          <Text style={styles.loginText}>Login</Text>
        </TouchableOpacity>
      )}

      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text>Nom du spot</Text>
            <TextInput value={spotName} onChangeText={setSpotName} style={styles.input} />
            <Text>Description</Text>
            <TextInput value={spotDescription} onChangeText={setSpotDescription} style={styles.input} />
            <TouchableOpacity onPress={() => setSpotIsPublic(!spotIsPublic)} style={styles.checkbox}>
              <MaterialIcons name={spotIsPublic ? 'check-box' : 'check-box-outline-blank'} size={24} />
              <Text> Spot Public</Text>
            </TouchableOpacity>
            <Button title="Enregistrer" onPress={saveNewSpot} />
            <Button title="Annuler" onPress={() => setModalVisible(false)} />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
  loaderContainer: {
    flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'white',
  },
  logo: {
    width: 320, height: 320, resizeMode: 'contain', marginBottom: 20,
  },
  userMarker: {
    alignItems: 'center', justifyContent: 'center',
  },
  outerCircle: {
    backgroundColor: '#3b82f6', borderRadius: 20, width: 40, height: 40,
    alignItems: 'center', justifyContent: 'center',
  },
  loginButton: {
    position: 'absolute', top: 40, right: 20, backgroundColor: '#3b82f6',
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, zIndex: 200,
  },
  loginText: {
    color: 'white', fontWeight: 'bold',
  },
  modalContainer: {
    flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.4)',
  },
  modalContent: {
    backgroundColor: 'white', padding: 20, borderRadius: 8, width: '80%',
  },
  input: {
    borderBottomWidth: 1, borderColor: '#ccc', marginBottom: 10,
  },
  checkbox: {
    flexDirection: 'row', alignItems: 'center', marginBottom: 10,
  },
});
