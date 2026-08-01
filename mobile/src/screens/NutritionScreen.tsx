import React, { useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Modal, TextInput, Alert, ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { doc, setDoc } from 'firebase/firestore';
import { User } from 'firebase/auth';
import { db as firestoreDB } from '../config/firebase';
import { TrainingDB, NutritionItem, NutritionCategory } from '../types';
import { NUTRITION_CATEGORIES, CATEGORY_COLORS } from '../nutrition';
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
  const [filter, setFilter] = useState<NutritionCategory | 'All'>('All');

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

  const items = filter === 'All' ? db.nutrition : db.nutrition.filter(n => (n.category ?? 'Other') === filter);

  return (
    <View style={styles.container}>
      <FlatList
        data={items}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <>
            <View style={styles.headerRow}>
              <Text style={styles.headerTitle}>Nutrition Database ({db.nutrition.length})</Text>
              <TouchableOpacity style={styles.addBtn} onPress={openAdd}>
                <Text style={styles.addBtnText}>+ Add Food</Text>
              </TouchableOpacity>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow} contentContainerStyle={styles.filterRowContent}>
              <FilterChip label="All" active={filter === 'All'} onPress={() => setFilter('All')} />
              {NUTRITION_CATEGORIES.map(cat => (
                <FilterChip key={cat} label={cat} active={filter === cat} onPress={() => setFilter(cat)} />
              ))}
            </ScrollView>
          </>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No nutrition items yet</Text>
            <Text style={styles.emptyBody}>
              Track your gels, bars, drinks and supplements. Add items to build your nutrition library.
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const category = item.category ?? 'Other';
          const categoryColor = CATEGORY_COLORS[category];
          const parts: string[] = [];
          parts.push(`${item.caloriesPerServing || 0} cal`);
          parts.push(`${item.carbsPerServing}g carbs`);
          parts.push(`${item.sodiumPerServing}mg Na`);
          if (Number(item.hydrationPerServing) > 0) parts.push(`${item.hydrationPerServing}mL water`);
          if (Number(item.caffeinePerServing) > 0) parts.push(`${item.caffeinePerServing}mg caffeine`);

          return (
            <View style={styles.card}>
              <View style={styles.cardMain}>
                <View style={styles.cardTitleRow}>
                  <Text style={styles.itemName}>{item.name}</Text>
                  <View style={[styles.categoryPill, { backgroundColor: `${categoryColor}26`, borderColor: categoryColor }]}>
                    <Text style={[styles.categoryPillText, { color: categoryColor }]}>{category}</Text>
                  </View>
                </View>
                <Text style={styles.statsLine}>{parts.join(' · ')}</Text>
                {!!item.notes && <Text style={styles.notesLine}>{item.notes}</Text>}
              </View>
              <View style={styles.cardActions}>
                <TouchableOpacity style={styles.iconBtn} onPress={() => openEdit(item)}>
                  <Ionicons name="create-outline" size={20} color={colors.amber} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.iconBtn} onPress={() => handleDelete(item.id)}>
                  <Ionicons name="trash-outline" size={20} color={colors.muted} />
                </TouchableOpacity>
              </View>
            </View>
          );
        }}
      />

      <NutritionModal
        visible={showModal}
        editingItem={editingItem}
        user={user}
        db={db}
        onSaved={onSaved}
        onClose={() => setShowModal(false)}
        onRequestDelete={(id) => { setShowModal(false); handleDelete(id); }}
      />
    </View>
  );
}

function FilterChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity style={[styles.chip, active && styles.chipActive]} onPress={onPress}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function NutritionModal({ visible, editingItem, user, db, onSaved, onClose, onRequestDelete }: {
  visible: boolean;
  editingItem: NutritionItem | null;
  user: User;
  db: TrainingDB;
  onSaved: (u: TrainingDB) => void;
  onClose: () => void;
  onRequestDelete: (id: string) => void;
}) {
  const [name,        setName]        = useState('');
  const [calories,    setCalories]    = useState('');
  const [carbs,       setCarbs]       = useState('');
  const [sodium,      setSodium]      = useState('');
  const [caffeine,    setCaffeine]    = useState('');
  const [hydration,   setHydration]   = useState('');
  const [category,    setCategory]    = useState<NutritionCategory>('Fuel');
  const [notes,       setNotes]       = useState('');
  const [servingUnit, setServingUnit] = useState('');
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [saving, setSaving] = useState(false);

  React.useEffect(() => {
    if (editingItem) {
      setName(editingItem.name);
      setCalories(editingItem.caloriesPerServing != null ? String(editingItem.caloriesPerServing) : '');
      setCarbs(String(editingItem.carbsPerServing));
      setSodium(String(editingItem.sodiumPerServing));
      setCaffeine(editingItem.caffeinePerServing != null ? String(editingItem.caffeinePerServing) : '');
      setHydration(String(editingItem.hydrationPerServing));
      setCategory(editingItem.category ?? 'Fuel');
      setNotes(editingItem.notes ?? '');
      setServingUnit(editingItem.servingUnit);
    } else {
      setName(''); setCalories(''); setCarbs(''); setSodium(''); setCaffeine('');
      setHydration(''); setCategory('Fuel'); setNotes(''); setServingUnit('');
    }
  }, [editingItem, visible]);

  const handleSave = async () => {
    if (!name.trim()) { Alert.alert('Name required'); return; }
    setSaving(true);
    const item: NutritionItem = {
      id: editingItem?.id ?? uid(),
      name: name.trim(),
      category,
      caloriesPerServing: Number(calories) || 0,
      carbsPerServing:     Number(carbs)     || 0,
      hydrationPerServing: Number(hydration) || 0,
      sodiumPerServing:    Number(sodium)    || 0,
      caffeinePerServing: Number(caffeine)  || 0,
      notes: notes.trim(),
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
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">
          <Text style={styles.modalTitle}>{editingItem ? 'Edit Item' : 'Add Food'}</Text>

          <Field label="Name *" value={name} onChange={setName} placeholder="e.g. Maurten Gel 100" />

          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Field label="Calories" value={calories} onChange={setCalories} keyboard="decimal-pad" placeholder="0" />
            </View>
            <View style={{ width: 12 }} />
            <View style={{ flex: 1 }}>
              <Field label="Carbs (g)" value={carbs} onChange={setCarbs} keyboard="decimal-pad" placeholder="0" />
            </View>
          </View>

          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Field label="Sodium (mg)" value={sodium} onChange={setSodium} keyboard="decimal-pad" placeholder="0" />
            </View>
            <View style={{ width: 12 }} />
            <View style={{ flex: 1 }}>
              <Field label="Caffeine (mg)" value={caffeine} onChange={setCaffeine} keyboard="decimal-pad" placeholder="0" />
            </View>
          </View>

          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Field label="Water (mL)" value={hydration} onChange={setHydration} keyboard="decimal-pad" placeholder="0" />
            </View>
            <View style={{ width: 12 }} />
            <View style={{ flex: 1 }}>
              <Field label="Serving unit" value={servingUnit} onChange={setServingUnit} placeholder="e.g. gel, bottle" />
            </View>
          </View>

          <Text style={styles.fieldLabel}>Category</Text>
          <TouchableOpacity style={styles.dropdown} onPress={() => setShowCategoryPicker(true)}>
            <Text style={styles.dropdownText}>{category}</Text>
            <Ionicons name="chevron-down" size={18} color={colors.muted} />
          </TouchableOpacity>

          <Field label="Notes" value={notes} onChange={setNotes} placeholder="e.g. brand, flavor, mix instructions" />

          <View style={styles.btnRow}>
            {editingItem && (
              <TouchableOpacity
                style={styles.deleteOutlineBtn}
                onPress={() => onRequestDelete(editingItem.id)}
              >
                <Text style={styles.deleteOutlineBtnText}>Delete</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.cancelOutlineBtn} onPress={onClose}>
              <Text style={styles.cancelOutlineBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.saveBtn, saving && { opacity: 0.6 }]}
              onPress={handleSave} disabled={saving}
            >
              <Text style={styles.saveBtnText}>{saving ? 'Saving…' : editingItem ? 'Save Changes' : 'Add Food'}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
        </KeyboardAvoidingView>
      </View>

      <Modal
        visible={showCategoryPicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCategoryPicker(false)}
      >
        <TouchableOpacity
          style={styles.pickerOverlay}
          activeOpacity={1}
          onPress={() => setShowCategoryPicker(false)}
        >
          <View style={styles.pickerSheet}>
            <Text style={styles.pickerTitle}>Select Category</Text>
            {NUTRITION_CATEGORIES.map(cat => (
              <TouchableOpacity
                key={cat}
                style={styles.pickerRow}
                onPress={() => { setCategory(cat); setShowCategoryPicker(false); }}
              >
                <View style={[styles.pickerDot, { backgroundColor: CATEGORY_COLORS[cat] }]} />
                <Text style={styles.pickerRowText}>{cat}</Text>
                {category === cat && <Ionicons name="checkmark" size={18} color={colors.text} />}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
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

  headerRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14,
  },
  headerTitle: { fontSize: 17, fontWeight: '700', color: colors.text },

  addBtn: {
    borderWidth: 1.5, borderColor: colors.green, borderRadius: 10,
    paddingVertical: 8, paddingHorizontal: 14,
  },
  addBtnText: { color: colors.green, fontWeight: '700', fontSize: 13 },

  filterRow: { marginBottom: 16 },
  filterRowContent: { gap: 8, paddingRight: 8 },
  chip: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 8,
    paddingVertical: 7, paddingHorizontal: 12, backgroundColor: colors.surface2,
  },
  chipActive: { borderColor: colors.green, backgroundColor: `${colors.green}1a` },
  chipText: { fontSize: 12, fontWeight: '600', color: colors.muted },
  chipTextActive: { color: colors.green },

  empty: { alignItems: 'center', padding: 40 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 8 },
  emptyBody:  { fontSize: 13, color: colors.muted, textAlign: 'center', lineHeight: 20 },

  card: {
    flexDirection: 'row', backgroundColor: colors.surface, borderRadius: 12, padding: 14,
    marginBottom: 10, borderWidth: 1, borderColor: colors.border,
  },
  cardMain: { flex: 1, paddingRight: 8 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  itemName:   { fontSize: 15, fontWeight: '700', color: colors.text },
  categoryPill: {
    borderWidth: 1, borderRadius: 20, paddingVertical: 2, paddingHorizontal: 8,
  },
  categoryPillText: { fontSize: 10, fontWeight: '700' },

  statsLine: { fontSize: 12.5, color: colors.muted, marginTop: 2 },
  notesLine: { fontSize: 12, color: colors.muted2, fontStyle: 'italic', marginTop: 4 },

  cardActions: { justifyContent: 'flex-start', alignItems: 'center', gap: 14 },
  iconBtn: { padding: 2 },

  // Modal
  modalContainer: { flex: 1, backgroundColor: colors.bg },
  modalContent: { padding: 20 },
  modalTitle: { fontSize: 20, fontWeight: '800', color: colors.text, marginBottom: 20 },

  fieldLabel: {
    fontSize: 12, color: colors.muted, fontWeight: '600',
    marginBottom: 6, marginTop: 14,
  },
  input: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: 10, padding: 12, color: colors.text, fontSize: 15,
  },
  row: { flexDirection: 'row' },

  dropdown: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: 10, padding: 12,
  },
  dropdownText: { color: colors.text, fontSize: 15 },

  btnRow: { flexDirection: 'row', gap: 10, marginTop: 28 },
  deleteOutlineBtn: {
    flex: 1, borderWidth: 1.5, borderColor: colors.red, borderRadius: 12,
    paddingVertical: 14, alignItems: 'center',
  },
  deleteOutlineBtnText: { color: colors.red, fontWeight: '700', fontSize: 14 },
  cancelOutlineBtn: {
    flex: 1, borderWidth: 1.5, borderColor: colors.border2, borderRadius: 12,
    paddingVertical: 14, alignItems: 'center',
  },
  cancelOutlineBtnText: { color: colors.muted, fontWeight: '700', fontSize: 14 },
  saveBtn: {
    flex: 1, backgroundColor: colors.green, borderRadius: 12,
    paddingVertical: 14, alignItems: 'center',
  },
  saveBtnText: { fontSize: 14, fontWeight: '800', color: '#06251c' },

  pickerOverlay: {
    flex: 1, backgroundColor: '#000000aa', justifyContent: 'center', alignItems: 'center', padding: 24,
  },
  pickerSheet: {
    backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.border,
    width: '100%', maxWidth: 380, padding: 8,
  },
  pickerTitle: {
    fontSize: 13, fontWeight: '700', color: colors.muted, textTransform: 'uppercase',
    letterSpacing: 1, paddingHorizontal: 12, paddingVertical: 10,
  },
  pickerRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 12, paddingVertical: 12, borderRadius: 10,
  },
  pickerDot: { width: 10, height: 10, borderRadius: 5 },
  pickerRowText: { fontSize: 14, color: colors.text, fontWeight: '600', flex: 1 },
});
