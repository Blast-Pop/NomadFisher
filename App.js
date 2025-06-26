import React, { useState, useEffect, useRef } from 'react';
import {
    StyleSheet, View, Alert, Modal, Text,
    TextInput, Button, TouchableOpacity,
} from 'react-native';
import MapView, { Marker, UrlTile } from 'react-native-maps';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { MaterialIcons } from '@expo/vector-icons';
import { supabase } from './lib/supabaseClient'; // ⚠️ Assure-toi que ce fichier existe

export default function App() {
    const [privateSpots, setPrivateSpots] = useState([]);
    const [publicSpots, setPublicSpots] = useState([]);
    const [region, setRegion] = useState({
        latitude: 46.8139,
        longitude: -71.208,
        latitudeDelta: 1,
        longitudeDelta: 1,
    });
    const [location, setLocation] = useState(null);
    const [heading, setHeading] = useState(0);
    const lastHeading = useRef(0);

    const [modalVisible, setModalVisible] = useState(false);
    const [newSpotCoords, setNewSpotCoords] = useState(null);
    const [spotName, setSpotName] = useState('');
    const [spotDescription, setSpotDescription] = useState('');
    const [spotIsPublic, setSpotIsPublic] = useState(false);

    useEffect(() => {
        (async () => {
            const { data, error } = await supabase.from('public_spots').select('*');
            if (error) console.error('Erreur chargement Supabase:', error.message);
            else setPublicSpots(data || []);
        })();

        (async () => {
            const stored = await AsyncStorage.getItem('private_spots');
            if (stored) setPrivateSpots(JSON.parse(stored));
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
                (loc) => {
                    setLocation(loc.coords);
                    setRegion((r) => ({
                        ...r,
                        latitude: loc.coords.latitude,
                        longitude: loc.coords.longitude,
                    }));
                }
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
        })();
    }, []);

    const handleMapPress = (event) => {
        const { coordinate } = event.nativeEvent;
        setNewSpotCoords(coordinate);
        setSpotName('');
        setSpotDescription('');
        setSpotIsPublic(false);
        setModalVisible(true);
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
                const { error } = await supabase.from('public_spots').insert([
                    {
                        name: spot.name,
                        description: spot.description,
                        latitude: spot.latitude,
                        longitude: spot.longitude,
                        type: 'pêche',
                    }
                ]);
                if (error) throw error;
                const { data } = await supabase.from('public_spots').select('*');
                setPublicSpots(data);
            } else {
                const updatedPrivate = [...privateSpots, spot];
                setPrivateSpots(updatedPrivate);
                await AsyncStorage.setItem('private_spots', JSON.stringify(updatedPrivate));
            }
            setModalVisible(false);
        } catch (e) {
            console.error('Erreur ajout spot', e);
            Alert.alert('Erreur', 'Impossible d\'ajouter le spot.');
        }
    };

    const [editModalVisible, setEditModalVisible] = useState(false);
    const [selectedSpotIndex, setSelectedSpotIndex] = useState(null);
    const [editedName, setEditedName] = useState('');
    const [editedDescription, setEditedDescription] = useState('');

    const openEditModal = (index) => {
        setSelectedSpotIndex(index);
        setEditedName(privateSpots[index].name);
        setEditedDescription(privateSpots[index].description || '');
        setEditModalVisible(true);
    };

    const saveSpotChanges = async () => {
        if (selectedSpotIndex === null) return;
        const updated = [...privateSpots];
        updated[selectedSpotIndex] = {
            ...updated[selectedSpotIndex],
            name: editedName,
            description: editedDescription,
        };
        setPrivateSpots(updated);
        await AsyncStorage.setItem('private_spots', JSON.stringify(updated));
        setEditModalVisible(false);
    };

    const deleteSpot = async () => {
        if (selectedSpotIndex === null) return;
        const updated = privateSpots.filter((_, i) => i !== selectedSpotIndex);
        setPrivateSpots(updated);
        await AsyncStorage.setItem('private_spots', JSON.stringify(updated));
        setEditModalVisible(false);
    };

    return (
        <View style={styles.container}>
            <MapView
                style={styles.map}
                region={region}
                onRegionChangeComplete={setRegion}
                onPress={handleMapPress}
            >
                <UrlTile urlTemplate="https://a.tile.openstreetmap.org/{z}/{x}/{y}.png" maximumZ={19} />

                {location && (
                    <Marker
                        coordinate={{ latitude: location.latitude, longitude: location.longitude }}
                        anchor={{ x: 0.5, y: 0.5 }}
                        flat={true}
                        rotation={heading}
                    >
                        <View style={styles.userMarker}>
                            <View style={styles.outerCircle}>
                                <MaterialIcons name="navigation" size={24} color="white" />
                            </View>
                        </View>
                    </Marker>
                )}

                {privateSpots.map((spot, i) => (
                    <Marker
                        key={'private-' + i}
                        coordinate={{ latitude: spot.latitude, longitude: spot.longitude }}
                        title={spot.name}
                        description={spot.description || ''}
                        pinColor="red"
                        onPress={() => openEditModal(i)}
                    />
                ))}

                {publicSpots.map((spot, i) => (
                    <Marker
                        key={'public-' + i}
                        coordinate={{ latitude: spot.latitude, longitude: spot.longitude }}
                        title={spot.name}
                        description={spot.description || ''}
                        pinColor="green"
                    />
                ))}
            </MapView>

            {/* Modal ajout */}
            <Modal visible={modalVisible} animationType="slide" transparent>
                <View style={styles.modalContainer}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Nouveau spot</Text>
                        <TextInput style={styles.input} placeholder="Nom" value={spotName} onChangeText={setSpotName} />
                        <TextInput style={[styles.input, { height: 80 }]} placeholder="Description" multiline value={spotDescription} onChangeText={setSpotDescription} />
                        <View style={{ flexDirection: 'row', marginBottom: 15, alignItems: 'center' }}>
                            <Text style={{ flex: 1 }}>Rendre public ?</Text>
                            <TouchableOpacity style={[styles.toggleButton, spotIsPublic ? styles.toggleActive : null]} onPress={() => setSpotIsPublic(true)}>
                                <Text style={spotIsPublic ? styles.toggleTextActive : styles.toggleText}>Oui</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.toggleButton, !spotIsPublic ? styles.toggleActive : null]} onPress={() => setSpotIsPublic(false)}>
                                <Text style={!spotIsPublic ? styles.toggleTextActive : styles.toggleText}>Non</Text>
                            </TouchableOpacity>
                        </View>
                        <View style={styles.modalButtons}>
                            <Button title="Annuler" onPress={() => setModalVisible(false)} />
                            <Button title="Ajouter" onPress={saveNewSpot} />
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Modal édition */}
            <Modal visible={editModalVisible} animationType="slide" transparent>
                <View style={styles.modalContainer}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Modifier spot privé</Text>
                        <TextInput style={styles.input} placeholder="Nom" value={editedName} onChangeText={setEditedName} />
                        <TextInput style={[styles.input, { height: 80 }]} placeholder="Description" multiline value={editedDescription} onChangeText={setEditedDescription} />
                        <View style={styles.modalButtons}>
                            <Button title="Annuler" onPress={() => setEditModalVisible(false)} />
                            <Button title="Enregistrer" onPress={saveSpotChanges} />
                            <Button title="Supprimer" color="red" onPress={deleteSpot} />
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    map: { flex: 1 },
    userMarker: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    outerCircle: {
        backgroundColor: '#3b82f6',
        borderRadius: 20,
        width: 40,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
    },
    modalContainer: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalContent: {
        backgroundColor: 'white',
        padding: 20,
        borderRadius: 10,
        width: '80%',
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 10,
    },
    input: {
        borderWidth: 1,
        borderColor: '#ccc',
        borderRadius: 5,
        padding: 10,
        marginBottom: 10,
    },
    modalButtons: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 10,
    },
    toggleButton: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderWidth: 1,
        borderColor: '#888',
        borderRadius: 5,
        marginHorizontal: 5,
    },
    toggleActive: {
        backgroundColor: '#3b82f6',
        borderColor: '#3b82f6',
    },
    toggleText: {
        color: '#888',
        fontWeight: 'bold',
    },
    toggleTextActive: {
        color: 'white',
        fontWeight: 'bold',
    },
});
