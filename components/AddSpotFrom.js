// components/AddSpotForm.js
import React, { useState } from 'react';
import { View, TextInput, Button, Alert, Text } from 'react-native';
import { supabase } from '../lib/supabaseClient';

export default function AddSpotForm({ location }) {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [type, setType] = useState('pêche'); // ou '4roues'

    const handleSubmit = async () => {
        if (!location) {
            Alert.alert("Erreur", "Position non disponible");
            return;
        }

        const { latitude, longitude } = location.coords;

        const { error } = await supabase
            .from('public_spots')
            .insert([
                {
                    name,
                    description,
                    latitude,
                    longitude,
                    type,
                }
            ]);

        if (error) {
            Alert.alert('Erreur', error.message);
        } else {
            Alert.alert('Succès', 'Spot ajouté avec succès !');
            setName('');
            setDescription('');
        }
    };

    return (
        <View style={{ padding: 10 }}>
            <Text>Nom du spot</Text>
            <TextInput
                value={name}
                onChangeText={setName}
                placeholder="Nom du spot"
                style={{ borderWidth: 1, marginBottom: 10, padding: 5 }}
            />

            <Text>Description</Text>
            <TextInput
                value={description}
                onChangeText={setDescription}
                placeholder="Description (facultatif)"
                style={{ borderWidth: 1, marginBottom: 10, padding: 5 }}
            />

            <Button title="Ajouter ce spot public" onPress={handleSubmit} />
        </View>
    );
}
