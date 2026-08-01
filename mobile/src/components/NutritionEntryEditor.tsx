import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput, Modal, ScrollView,
} from 'react-native';
import { colors } from '../theme';
import { NutritionItem, NutritionLogEntry } from '../types';
import { nutrPerHour } from '../nutrition';

interface Props {
  library: NutritionItem[];
  entries: NutritionLogEntry[];
  onChange: (entries: NutritionLogEntry[]) => void;
  durationMins: number;
  elapsedMins?: number;
  accentColor: string;
  enabled: boolean;
  onToggleEnabled: () => void;
}

// Line-by-line nutrition editor with a live per-hour tally — shared by AddWorkoutScreen,
// EditWorkoutModal, and CalendarScreen's MarkDoneModal.
export default function NutritionEntryEditor({
  library, entries, onChange, durationMins, elapsedMins, accentColor, enabled, onToggleEnabled,
}: Props) {
  const [pickerIndex, setPickerIndex] = useState<number | null>(null);

  if (library.length === 0) return null;

  const addItem = () => onChange([...entries, { itemId: library[0].id, servings: 1 }]);
  const updateItem = (index: number, patch: Partial<NutritionLogEntry>) =>
    onChange(entries.map((e, i) => (i === index ? { ...e, ...patch } : e)));
  const removeItem = (index: number) => onChange(entries.filter((_, i) => i !== index));

  const stats = nutrPerHour(entries, library, durationMins, elapsedMins);

  return (
    <>
      <TouchableOpacity style={styles.toggle} onPress={onToggleEnabled}>
        <View style={[styles.checkbox, enabled && { backgroundColor: accentColor, borderColor: accentColor }]}>
          {enabled && <Text style={styles.checkmark}>✓</Text>}
        </View>
        <Text style={styles.toggleText}>Add nutrition?</Text>
      </TouchableOpacity>

      {enabled && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>NUTRITION USED</Text>

          {entries.map((entry, index) => {
            const item = library.find(n => n.id === entry.itemId);
            return (
              <View key={index} style={styles.row}>
                <TouchableOpacity style={styles.itemPicker} onPress={() => setPickerIndex(index)}>
                  <Text style={styles.itemPickerText} numberOfLines={1}>
                    {item?.name ?? 'Select item'}
                  </Text>
                  <Text style={styles.itemPickerCaret}>▾</Text>
                </TouchableOpacity>
                <TextInput
                  style={styles.qtyInput}
                  value={String(entry.servings)}
                  onChangeText={(v) => updateItem(index, { servings: Number(v) || 0 })}
                  keyboardType="decimal-pad"
                  placeholder="Qty"
                  placeholderTextColor={colors.muted2}
                />
                <TouchableOpacity style={styles.removeBtn} onPress={() => removeItem(index)}>
                  <Text style={styles.removeBtnText}>✕</Text>
                </TouchableOpacity>
              </View>
            );
          })}

          <TouchableOpacity style={styles.addBtn} onPress={addItem}>
            <Text style={[styles.addBtnText, { color: accentColor }]}>+ Add Item</Text>
          </TouchableOpacity>

          {stats && (
            <View style={styles.totals}>
              <View>
                <Text style={[styles.totalVal, { color: colors.green }]}>{stats.carbs}</Text>
                <Text style={styles.totalLabel}>G CARBS / HR</Text>
              </View>
              <View>
                <Text style={[styles.totalVal, { color: colors.blue }]}>{stats.hydration}</Text>
                <Text style={styles.totalLabel}>ML / HR</Text>
              </View>
              <View>
                <Text style={[styles.totalVal, { color: colors.amber }]}>{stats.sodium}</Text>
                <Text style={styles.totalLabel}>MG SODIUM / HR</Text>
              </View>
            </View>
          )}
        </View>
      )}

      {/* Item picker sheet — RN has no native <select>, so tapping a row opens this */}
      <Modal
        visible={pickerIndex !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setPickerIndex(null)}
      >
        <TouchableOpacity
          style={styles.pickerOverlay}
          activeOpacity={1}
          onPress={() => setPickerIndex(null)}
        >
          <View style={styles.pickerSheet}>
            <Text style={styles.pickerTitle}>Select Item</Text>
            <ScrollView style={{ maxHeight: 340 }}>
              {library.map(item => (
                <TouchableOpacity
                  key={item.id}
                  style={styles.pickerRow}
                  onPress={() => {
                    if (pickerIndex !== null) updateItem(pickerIndex, { itemId: item.id });
                    setPickerIndex(null);
                  }}
                >
                  <Text style={styles.pickerRowText}>{item.name}</Text>
                  <Text style={styles.pickerRowMeta}>
                    {Number(item.carbsPerServing) > 0 ? `${item.carbsPerServing}g carbs` : ''}
                    {Number(item.hydrationPerServing) > 0 ? ` · ${item.hydrationPerServing}mL` : ''}
                    {Number(item.sodiumPerServing) > 0 ? ` · ${item.sodiumPerServing}mg Na` : ''}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  toggle: { flexDirection: 'row', alignItems: 'center', marginTop: 16, marginBottom: 4 },
  checkbox: {
    width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center', marginRight: 10,
  },
  checkmark: { color: '#fff', fontWeight: '800', fontSize: 13 },
  toggleText: { fontSize: 14, fontWeight: '600', color: colors.text },

  section: {
    backgroundColor: colors.surface2, borderRadius: 12, padding: 12, marginTop: 10,
  },
  sectionLabel: {
    fontSize: 10, color: colors.muted, fontWeight: '700', letterSpacing: 0.5,
    textTransform: 'uppercase', marginBottom: 10,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  itemPicker: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.surface3, borderRadius: 8, borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: 10, paddingVertical: 10,
  },
  itemPickerText: { fontSize: 13, color: colors.text, flex: 1 },
  itemPickerCaret: { fontSize: 11, color: colors.muted, marginLeft: 4 },
  qtyInput: {
    width: 64, backgroundColor: colors.surface3, borderRadius: 8, borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: 10, paddingVertical: 10, fontSize: 13, color: colors.text, textAlign: 'center',
  },
  removeBtn: {
    width: 32, height: 32, borderRadius: 8, borderWidth: 1, borderColor: colors.red,
    alignItems: 'center', justifyContent: 'center',
  },
  removeBtnText: { color: colors.red, fontSize: 13, fontWeight: '700' },

  addBtn: { alignSelf: 'flex-start', marginTop: 2, marginBottom: 4 },
  addBtnText: { fontSize: 13, fontWeight: '700' },

  totals: {
    flexDirection: 'row', justifyContent: 'space-around',
    marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border,
  },
  totalVal: { fontSize: 18, fontWeight: '800', textAlign: 'center' },
  totalLabel: { fontSize: 9, color: colors.muted, fontWeight: '700', letterSpacing: 0.5, marginTop: 2, textAlign: 'center' },

  pickerOverlay: {
    flex: 1, backgroundColor: '#000000aa', justifyContent: 'center', alignItems: 'center', padding: 24,
  },
  pickerSheet: {
    backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.border,
    width: '100%', maxWidth: 380, padding: 8,
  },
  pickerTitle: {
    fontSize: 13, fontWeight: '700', color: colors.muted, textTransform: 'uppercase',
    letterSpacing: 1, paddingHorizontal: 12, paddingVertical: 8,
  },
  pickerRow: { paddingHorizontal: 12, paddingVertical: 12, borderRadius: 10 },
  pickerRowText: { fontSize: 14, color: colors.text, fontWeight: '600' },
  pickerRowMeta: { fontSize: 11, color: colors.muted, marginTop: 2 },
});
