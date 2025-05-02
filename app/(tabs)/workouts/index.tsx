// app/(tabs)/workouts/index.tsx
import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  SectionList,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Modal,
  ScrollView,
  SafeAreaView,
  Platform,
  Alert,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import {
  AntDesign,
  MaterialCommunityIcons,
  Feather,
} from '@expo/vector-icons';
import {
  collection,
  getDocs,
  getDoc,          // ← added
  query,
  orderBy,
  doc,
  setDoc,
  Timestamp,
  deleteDoc,
} from 'firebase/firestore';
import { db, auth } from '../../../lib/firebaseConfig';
import { useRouter } from 'expo-router';

/* ── helpers ──────────────────────────────────────────────── */
const purple = '#5b4df0';
const buildDayId = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`;

/* filter chip master lists */
const BODY = [
  'chest',
  'back',
  'shoulders',
  'biceps',
  'triceps',
  'quads',
  'hamstrings',
  'glutes',
  'calves',
  'core',
  'cardio',
  'full body',
];
const DIFF = ['beginner', 'intermediate', 'advanced'];
const EQUIP = [
  'bodyweight',
  'dumbbells',
  'barbell',
  'cable machine',
  'machine',
  'bench',
  'kettlebells',
  'EZ bar',
  'medicine ball',
  'dip bars',
];
const GOAL = [
  'build muscle',
  'strength',
  'power',
  'hypertrophy',
  'mobility',
  'conditioning',
  'endurance',
  'fat loss',
  'core stability',
  'posture',
  'HIIT',
];

function Chip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, active && { backgroundColor: purple }]}
    >
      <Text
        style={[styles.chipTxt, active && { color: '#fff' }]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const uniqByName = (arr: any[]) => {
  const seen = new Set<string>();
  return arr.filter((w) => {
    const k = w.name.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
};

/* ────────────────────────────────────────────────────────── */
export default function WorkoutsHome() {
  const router = useRouter();
  const uid = auth.currentUser?.uid;

  /* 1) fetch the workout catalog once */
  const [all, setAll] = useState<any[] | null>(null);
  useEffect(() => {
    (async () => {
      const snap = await getDocs(collection(db, 'workouts'));
      setAll(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    })();
  }, []);

  /* 2) day handling (mirror of Nutrition tab) */
  const [days, setDays] = useState<string[]>([]);
  const [dateId, setDateId] = useState<string | null>(null);

  useEffect(() => {
    if (!uid) return;

    (async () => {
      const todayId = buildDayId(new Date());
      const colRef = collection(db, 'users', uid, 'days');
      const snap = await getDocs(query(colRef, orderBy('__name__', 'desc')));
      let ids = snap.docs.map((d) => d.id);

      /* seed today if needed */
      if (!ids.includes(todayId)) {
        await setDoc(
          doc(db, 'users', uid, 'days', todayId),
          { workouts: [], meals: [], water: 0, createdAt: Timestamp.now() },
          { merge: true },
        );
        ids = [todayId, ...ids];
      }
      setDays(ids);
      setDateId(todayId);
    })();
  }, [uid]);

  /* modal for new day */
  const [modalOpen, setModalOpen] = useState(false);
  const [pickDate, setPickDate] = useState(new Date());

  const createDay = async () => {
    if (!uid) return;
    const id = buildDayId(pickDate);
    const ref = doc(db, 'users', uid, 'days', id);
    const snap = await getDoc(ref);

    /* only create if it doesn't exist */
    if (!snap.exists()) {
      await setDoc(ref, {
        workouts: [],
        meals: [],
        water: 0,
        createdAt: Timestamp.now(),
      });
    }

    setDays((cur) => (cur.includes(id) ? cur : [id, ...cur]));
    setDateId(id);
    setModalOpen(false);
  };

  const confirmDelete = () => {
    if (!uid || !dateId) return;
    Alert.alert('Delete this day?', 'All logged workouts will be removed.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteDoc(doc(db, 'users', uid, 'days', dateId));
          setDays((cur) => {
            const next = cur.filter((d) => d !== dateId);
            setDateId(next[0] ?? null);
            return next;
          });
        },
      },
    ]);
  };

  /* 3) filters */
  const [body, setBody] = useState<string | null>(null);
  const [diff, setDiff] = useState<string | null>(null);
  const [equip, setEquip] = useState<string | null>(null);
  const [goal, setGoal] = useState<string | null>(null);

  /* 4) grouping */
  const [group, setGroup] = useState<
    'none' | 'bodyParts' | 'difficulty' | 'equipment' | 'goals'
  >('bodyParts');

  /* 5) sheet (filter selector) */
  const [sheetOpen, setSheetOpen] = useState(false);

  /* 6) filtered + grouped data */
  const filtered = useMemo(() => {
    if (!all) return [];
    return all.filter(
      (w) =>
        (!body || w.bodyParts?.includes(body)) &&
        (!diff || w.difficulty === diff) &&
        (!equip || w.equipment?.includes(equip)) &&
        (!goal || w.goals?.includes(goal)),
    );
  }, [all, body, diff, equip, goal]);

  const sections = useMemo(() => {
    if (group === 'none')
      return [{ title: 'ALL WORKOUTS', data: uniqByName(filtered) }];

    const buckets: Record<string, any[]> = {};
    filtered.forEach((w) => {
      const tags: string[] = Array.isArray(w[group]) ? w[group] : [w[group]];
      tags.forEach((t) => {
        if (!buckets[t]) buckets[t] = [];
        if (
          !buckets[t].some(
            (x) => x.name.toLowerCase() === w.name.toLowerCase(),
          )
        )
          buckets[t].push(w);
      });
    });
    return Object.entries(buckets)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([title, data]) => ({ title: title.toUpperCase(), data }));
  }, [filtered, group]);

  /* 7) loading state */
  if (!all) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={purple} />
      </View>
    );
  }

  /* ───────────── UI ───────────── */
  return (
    <SafeAreaView style={styles.safe}>
      {/* header */}
      <View style={styles.dateRow}>
        <Text style={styles.h1}>
          {dateId ? `Workouts • ${dateId}` : 'No day selected'}
        </Text>

        {/* open day log */}
        {dateId && (
          <Pressable
            style={styles.iconBtn}
            onPress={() =>
              router.push({
                pathname: '/workouts/day-log',
                params: { day: dateId },
              })
            }
          >
            <Feather name="list" size={20} color="#fff" />
          </Pressable>
        )}

        <Pressable style={styles.iconBtn} onPress={() => setModalOpen(true)}>
          <MaterialCommunityIcons name="calendar-plus" size={20} color="#fff" />
        </Pressable>
        {dateId && (
          <Pressable style={styles.iconBtn} onPress={confirmDelete}>
            <MaterialCommunityIcons
              name="trash-can"
              size={20}
              color="#fca5a5"
            />
          </Pressable>
        )}
      </View>

      {/* active filter tags */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tagsRow}
      >
        {body && <Tag txt={body} onClear={() => setBody(null)} />}
        {diff && <Tag txt={diff} onClear={() => setDiff(null)} />}
        {equip && <Tag txt={equip} onClear={() => setEquip(null)} />}
        {goal && <Tag txt={goal} onClear={() => setGoal(null)} />}
      </ScrollView>

      {/* grouping chips */}
      <View style={styles.groupRow}>
        {['none', 'bodyParts', 'difficulty', 'equipment', 'goals'].map((k) => (
          <Chip
            key={k}
            label={k === 'none' ? 'no grouping' : k}
            active={group === k}
            onPress={() => setGroup(k as any)}
          />
        ))}
      </View>

      {/* list */}
      <SectionList
        sections={sections}
        keyExtractor={(i) => i.id}
        stickySectionHeadersEnabled
        contentContainerStyle={{ paddingBottom: 40, paddingHorizontal: 14 }}
        renderSectionHeader={({ section: { title } }) => (
          <Text style={styles.section}>{title}</Text>
        )}
        renderItem={({ item }) => (
          <Pressable
            onPress={() =>
              router.push({
                pathname: '/workouts/details',
                params: { wid: item.id, day: dateId ?? '' },
              })
            }
            style={styles.card}
          >
            <Text style={styles.name}>{item.name}</Text>
            <Text style={styles.meta}>
              {item.difficulty} • {item.bodyParts.join(', ')}
            </Text>
          </Pressable>
        )}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
      />

      {/* filter‑sheet */}
      <Modal
        animationType="slide"
        visible={sheetOpen}
        onRequestClose={() => setSheetOpen(false)}
      >
        <SafeAreaView style={styles.sheet}>
          <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
            <Sheet title="Body Part" opts={BODY} val={body} set={setBody} />
            <Sheet
              title="Difficulty"
              opts={DIFF}
              val={diff}
              set={setDiff}
            />
            <Sheet
              title="Equipment"
              opts={EQUIP}
              val={equip}
              set={setEquip}
            />
            <Sheet title="Goal" opts={GOAL} val={goal} set={setGoal} />
          </ScrollView>
          <Pressable style={styles.done} onPress={() => setSheetOpen(false)}>
            <Text style={{ color: '#fff', fontWeight: '600' }}>Done</Text>
          </Pressable>
        </SafeAreaView>
      </Modal>

      {/* new‑day modal */}
      <Modal visible={modalOpen} transparent animationType="slide">
        <View style={styles.backdrop}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Select a date</Text>
            <DateTimePicker
              value={pickDate}
              mode="date"
              display={Platform.OS === 'ios' ? 'inline' : 'default'}
              onChange={(_, d) => d && setPickDate(d)}
              minimumDate={new Date(2020, 0, 1)}
              maximumDate={new Date(2100, 11, 31)}
              style={{ alignSelf: 'center' }}
            />
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'flex-end',
                marginTop: 20,
              }}
            >
              <Pressable
                style={styles.modalCancel}
                onPress={() => setModalOpen(false)}
              >
                <Text style={styles.modalCancelTxt}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.modalSave} onPress={createDay}>
                <Text style={styles.modalSaveTxt}>Save</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

/* small tag pill */
function Tag({ txt, onClear }: { txt: string; onClear: () => void }) {
  return (
    <View style={styles.tag}>
      <Text style={styles.tagTxt}>{txt}</Text>
      <Pressable onPress={onClear} style={{ marginLeft: 4 }}>
        <AntDesign name="close" size={11} color="#fff" />
      </Pressable>
    </View>
  );
}

/* sheet block */
function Sheet({
  title,
  opts,
  val,
  set,
}: {
  title: string;
  opts: string[];
  val: string | null;
  set: (v: string | null) => void;
}) {
  return (
    <View style={{ marginTop: 18 }}>
      <Text style={styles.sheetH}>{title}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        <Chip label="All" active={val === null} onPress={() => set(null)} />
        {opts.map((o) => (
          <Chip
            key={o}
            label={o}
            active={val === o}
            onPress={() => set(o)}
          />
        ))}
      </View>
    </View>
  );
}

/* ── styles ───────────────────────────────────────────────── */
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f5f6ff' },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f6ff',
  },

  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: purple,
  },
  h1: { flex: 1, color: '#fff', fontSize: 20, fontWeight: '700' },
  iconBtn: {
    padding: 6,
    backgroundColor: 'rgba(0,0,0,0.15)',
    borderRadius: 14,
    marginLeft: 6,
  },

  tagsRow: { paddingHorizontal: 14, marginTop: 10 },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: purple,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
    marginRight: 6,
  },
  tagTxt: { color: '#fff', fontSize: 13 },

  groupRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 14,
    marginTop: 12,
  },
  chip: {
    borderWidth: 1,
    borderColor: purple,
    borderRadius: 18,
    paddingVertical: 8,
    paddingHorizontal: 18,
    flexGrow: 1,
    alignItems: 'center',
  },
  chipTxt: { color: purple, fontSize: 13, maxWidth: 130 },

  section: {
    backgroundColor: '#e6e7ff',
    padding: 6,
    borderRadius: 6,
    color: '#3940a0',
    fontWeight: '700',
    marginTop: 24,
  },

  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 3 },
    ...Platform.select({ android: { elevation: 3 } }),
  },
  name: { fontWeight: '600', fontSize: 16, color: '#1e1f36' },
  meta: { color: '#677086', fontSize: 12, marginTop: 2 },

  sheet: { flex: 1, backgroundColor: '#fff', paddingHorizontal: 16 },
  sheetH: { fontWeight: '700', color: '#32397f', marginBottom: 6 },
  done: {
    alignSelf: 'center',
    marginVertical: 16,
    backgroundColor: purple,
    paddingHorizontal: 40,
    paddingVertical: 12,
    borderRadius: 22,
  },

  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  modal: {
    width: '100%',
    borderRadius: 22,
    padding: 24,
    backgroundColor: '#1e1b4b',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 18,
    alignSelf: 'center',
  },
  modalCancel: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 14,
    marginRight: 10,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  modalSave: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 14,
    backgroundColor: purple,
  },
  modalCancelTxt: { color: '#94a3b8', fontWeight: '600' },
  modalSaveTxt: { color: '#fff', fontWeight: '600' },
});
