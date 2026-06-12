import React, { useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Modal, TextInput, Alert,
} from 'react-native';
import { doc, setDoc } from 'firebase/firestore';
import { User } from 'firebase/auth';
import { db as firestoreDB } from '../config/firebase';
import { TrainingDB, NutritionItem } from '../types';
import { colors } from '../theme';

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

interface Props {
  user: User;
  db: TrainingDB;
  onSaved: (updated: TrainingDB) => void;
}

export default function NutritionScreen({ user, db, onSaved }: Props) {
  const [editingItem, setEditingItem] = useState<NutritionItem | null>(null);
  const [showModal, setShowModal] = useState(false);

  const openAdd = () => {
    setEditingItem(null);
    setShowModal(true);
  };

  const openEdit = (item: NutritionItem) => {
    setEditingItem(item);
    setShowModal(true);
  };

  const handleDelete = (itemId: string) => {
    Alert.alert('Delete item', 'Remove this nutrition item?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          const newDB = { ...db, nutrition: db.nutrition.filter(n => n.id !== itemId) };
          try {
            await setDoc(doc(firestoreDB, 'users', user.uid, 'db', 'data'), JSON.parse(JSON.stringify(newDB)));
            onSaved(newDB);
          } catch (err: any) { Alert.alert('Error', err.message); }
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={db.nutrition}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <TouchableOpacity style={styles.addBtn} onPress={openAdd}>
            <Text style={styles.addBtnText}>+ Add Nutrition Item</Text>
          </TouchableOpacity>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No nutrition items yet</Text>
            <Text style={styles.emptyBody}>
              Track your gels, bars, drinks and supplements. Add items to build your nutrition library.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.card} onPress={() => openEdit(item)} activeOpacity={0.7}>
            <View style={styles.cardHeader}>
              <Text style={styles.itemName}>{item.name}</Text>
              <TouchableOpacity onPress={() => handleDelete(item.id)}>
                <Text style={styles.deleteBtn}>✕</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.statsRow}>
              <StatBubble label="Carbs" value={`${item.carbsPerServing}g`} color={colors.amber} />
              <StatBubble label="Hydration" value={`${item.hydrationPerServing}mL`} color={colors.blue} />
              <StatBubble label="Sodium" value={`${item.sodiumPerServing}mg`} color={colors.pink} />
            </View>
            <Text style={styles.servingUnit}>Per {item.servingUnit || 'serving'}</Text>
          </TouchableOpacity>
        )}
      />

      <NutritionModal
        visible={showModal}
        editingItem={editingItem}
        user={user}
        db={db}
        onSaved={onSaved}
        onClose={() => setShowModal(false)}
      />
    </View>
  );
}

function StatBubble({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={[styles.statBubble, { borderColor: color }]}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function NutritionModal({ visible, editingItem, user, db, onSaved, onClose }: {
  visible: boolean;
  editingItem: NutritionItem | null;
  user: User;
  db: TrainingDB;
  onSaved: (u: TrainingDB) => void;
  onClose: () => void;
}) {
  const [name,        setName]        = useState('');
  const [carbs,       setCarbs]       = useState('');
  const [hydration,   setHydration]   = useState('');
  const [sodium,      setSodium]      = useState('');
  const [servingUnit, setServingUnit] = useState('');
  const [saving, setSaving] = useState(false);

  React.useEffect(() => {
    if (editingItem) {
      setName(editingItem.name);
      setCarbs(String(editingItem.carbsPerServing));
      setHydration(String(editingItem.hydrationPerServing));
      setSodium(String(editingItem.sodiumPerServing));
      setServingUnit(editingItem.servingUnit);
    } else {
      setName(''); setCarbs(''); setHydration(''); setSodium(''); setServingUnit('');
    }
  }, [editingItem, visible]);

  const handleSave = async () => {
    if (!name.trim()) { Alert.alert('Name required'); return; }
    setSaving(true);
    const item: NutritionItem = {
      id: editingItem?.id ?? uid(),
      name: name.trim(),
      carbsPerServing:     Number(carbs)     || 0,
      hydrationPerServing: Number(hydration) || 0,
      sodiumPerServing:    Number(sodium)    || 0,
      servingUnit: servingUnit.trim() || 'serving',
    };
    const newDB = {
      ...db,
      nutrition: editingItem
        ? db.nutrition.map(n => n.id === editingItem.id ? item : n)
        : [...db.nutrition, item],
    };
    try {
      await setDoc(doc(firestoreDB, 'users', user.uid, 'db', 'data'), JSON.parse(JSON.stringify(newDB)));
      onSaved(newDB);
      onClose();
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={onClose}><Text style={styles.cancelBtn}>Cancel</Text></TouchableOpacity>
          <Text style={styles.modalTitle}>{editingItem ? 'Edit Item' : 'Add Nutrition Item'}</Text>
          <View style={{ width: 60 }} />
        </View>

        <View style={styles.modalContent}>
          <Field label="ITEM NAME" value={name} onChange={setName} placeholder="e.g. Maurten Gel 100" />
          <Field label="SERVING UNIT" value={servingUnit} onChange={setServingUnit} placeholder="e.g. gel, bottle, scoop, bar" />

          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Field label="CARBS (g)" value={carbs} onChange={setCarbs} keyboard="decimal-pad" placeholder="0" />
            </View>
            <View style={{ width: 12 }} />
            <View style={{ flex: 1 }}>
              <Field label="HYDRATION (mL)" value={hydration} onChange={setHydration} keyboard="decimal-pad" placeholder="0" />
            </View>
          </View>

          <Field label="SODIUM (mg)" value={sodium} onChange={setSodium} keyboard="decimal-pad" placeholder="0" />

          <TouchableOpacity
            style={[styles.saveBtn, saving && { opacity: 0.6 }]}
            onPress={handleSave} disabled={saving}
          >
            <Text style={styles.saveBtnText}>{saving ? 'Saving…' : 'Save Item'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

function Field({ label, value, onChange, placeholder, keyboard }: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; keyboard?: 'decimal-pad';
}) {
  return (
    <View>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={styles.input} value={value} onChangeText={onChange}
        placeholder={placeholder} placeholderTextColor={colors.muted2}
        keyboardType={keyboard ?? 'default'}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  list: { padding: 16, paddingBottom: 40 },

  addBtn: {
    backgroundColor: colors.pink, borderRadius: 12,
    paddingVertical: 14, alignItems: 'center', marginBottom: 16,
  },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  empty: { alignItems: 'center', padding: 40 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 8 },
  emptyBody:  { fontSize: 13, color: colors.muted, textAlign: 'center', lineHeight: 20 },

  card: {
    backgroundColor: colors.surface, borderRadius: 12, padding: 14,
    marginBottom: 10, borderWidth: 1, borderColor: colors.border,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  itemName:   { fontSize: 15, fontWeight: '700', color: colors.text, flex: 1 },
  deleteBtn:  { color: colors.red, fontSize: 16, paddingLeft: 12 },

  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 6 },
  statBubble: {
    flex: 1, borderWidth: 1, borderRadius: 8, padding: 8, alignItems: 'center',
  },
  statValue: { fontSize: 14, fontWeight: '700' },
  statLabel: { fontSize: 10, color: colors.muted, marginTop: 2, textTransform: 'uppercase' },

  servingUnit: { fontSize: 11, color: colors.muted2, marginTop: 2 },

  // Modal
  modalContainer: { flex: 1, backgroundColor: colors.bg },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.surface,
  },
  modalTitle:  { fontSize: 16, fontWeight: '700', color: colors.text },
  cancelBtn:   { fontSize: 15, color: colors.muted, width: 60 },
  modalContent: { padding: 20 },

  fieldLabel: {
    fontSize: 11, color: colors.muted, fontWeight: '600',
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6, marginTop: 14,
  },
  input: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: 10, padding: 12, color: colors.text, fontSize: 15,
  },
  row: { flexDirection: 'row' },
  saveBtn: {
    backgroundColor: colors.pink, borderRadius: 12,
    paddingVertical: 16, alignItems: 'center', marginTop: 28,
  },
  saveBtnText: { fontSize: 16, fontWeight: '800', color: '#fff' },
});
