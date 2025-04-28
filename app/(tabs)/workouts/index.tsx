import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, SectionList, Pressable, StyleSheet,
  ActivityIndicator, Modal, ScrollView, SafeAreaView, Platform
} from 'react-native';
import { AntDesign } from '@expo/vector-icons';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../../lib/firebaseConfig';
import { useRouter } from 'expo-router';

/* ─── constants ─── */
const purple = '#5b4df0';
const BODY  = ['chest','back','shoulders','biceps','triceps','quads',
               'hamstrings','glutes','calves','core','cardio','full body'];
const DIFF  = ['beginner','intermediate','advanced'];
const EQUIP = ['bodyweight','dumbbells','barbell','cable machine','machine',
               'bench','kettlebells','EZ bar','medicine ball','dip bars'];
const GOAL  = ['build muscle','strength','power','hypertrophy','mobility',
               'conditioning','endurance','fat loss','core stability','posture','HIIT'];

/* ─── reusable chip ─── */
function Chip({ label, active, onPress }:{
  label:string; active:boolean; onPress:()=>void }) {
  return (
    <Pressable onPress={onPress}
      style={[styles.chip, active && { backgroundColor: purple }]}>
      <Text style={[styles.chipTxt, active && { color: '#fff' }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

/* ─── helper to keep one per name ─── */
const uniqByName = (arr:any[]) => {
  const seen = new Set<string>();
  return arr.filter(w => {
    const key = w.name.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

export default function Workouts() {
  const router = useRouter();

  /* fetch once */
  const [all, setAll] = useState<any[] | null>(null);
  useEffect(() => { (async () => {
    const snap = await getDocs(collection(db, 'workouts'));
    setAll(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  })(); }, []);

  /* filters */
  const [body,  setBody]  = useState<string | null>(null);
  const [diff,  setDiff]  = useState<string | null>(null);
  const [equip, setEquip] = useState<string | null>(null);
  const [goal,  setGoal]  = useState<string | null>(null);

  /* grouping */
  const [group, setGroup] =
    useState<'none'|'bodyParts'|'difficulty'|'equipment'|'goals'>('bodyParts');

  /* filter-sheet */
  const [open, setOpen] = useState(false);

  /* apply filters */
  const filtered = useMemo(() => {
    if (!all) return [];
    return all.filter(w =>
      (!body  || w.bodyParts?.includes(body)) &&
      (!diff  || w.difficulty === diff)      &&
      (!equip || w.equipment?.includes(equip)) &&
      (!goal  || w.goals?.includes(goal))
    );
  }, [all, body, diff, equip, goal]);

  /* build sections */
  const sections = useMemo(() => {
    if (group === 'none') {
      return [{ title: 'ALL WORKOUTS', data: uniqByName(filtered) }];
    }
    const buckets: Record<string, any[]> = {};
    filtered.forEach(w => {
      const tags: string[] = Array.isArray(w[group]) ? w[group] : [w[group]];
      tags.forEach(t => {
        if (!buckets[t]) buckets[t] = [];
        if (!buckets[t].some(x => x.name.toLowerCase() === w.name.toLowerCase()))
          buckets[t].push(w);
      });
    });
    return Object.entries(buckets)
      .sort(([a],[b]) => a.localeCompare(b))
      .map(([title,data]) => ({ title: title.toUpperCase(), data }));
  }, [filtered, group]);

  /* loading */
  if (!all) {
    return <View style={styles.center}><ActivityIndicator size="large" color={purple} /></View>;
  }

  return (
    <SafeAreaView style={styles.safe}>

      {/* top bar */}
      <View style={styles.topBar}>
        <Text style={styles.topTitle}>Workouts</Text>
        <Pressable style={styles.iconBtn} onPress={() => setOpen(true)}>
          <AntDesign name="filter" size={20} color="#fff" />
        </Pressable>
      </View>

      {/* active tags */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tagsRow}>
        {body  && <Tag txt={body}   onClear={() => setBody(null)} />}
        {diff  && <Tag txt={diff}   onClear={() => setDiff(null)} />}
        {equip && <Tag txt={equip}  onClear={() => setEquip(null)} />}
        {goal  && <Tag txt={goal}   onClear={() => setGoal(null)} />}
      </ScrollView>

      {/* grouping pills */}
      <View style={styles.groupRow}>
        {['none','bodyParts','difficulty','equipment','goals'].map(k => (
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
        keyExtractor={i => i.id}
        stickySectionHeadersEnabled
        contentContainerStyle={{ paddingBottom: 40, paddingHorizontal: 14 }}
        renderSectionHeader={({ section:{title} }) => (
          <Text style={styles.section}>{title}</Text>
        )}
        renderItem={({ item }) => (
          <Pressable
            /* ── NEW: go to /workouts/details and pass wid param ── */
            onPress={() => router.push({ pathname: '/workouts/details', params: { wid: item.id } })}
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

      {/* filter sheet */}
      <Modal animationType="slide" visible={open} onRequestClose={() => setOpen(false)}>
        <SafeAreaView style={styles.sheet}>
          <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
            <Sheet title="Body Part"   opts={BODY}  val={body}  set={setBody}  />
            <Sheet title="Difficulty"  opts={DIFF}  val={diff}  set={setDiff}  />
            <Sheet title="Equipment"   opts={EQUIP} val={equip} set={setEquip} />
            <Sheet title="Goal"        opts={GOAL}  val={goal}  set={setGoal}  />
          </ScrollView>
          <Pressable style={styles.done} onPress={() => setOpen(false)}>
            <Text style={{ color:'#fff', fontWeight:'600' }}>Done</Text>
          </Pressable>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

/* tag pill */
function Tag({ txt, onClear }:{txt:string; onClear:()=>void }) {
  return (
    <View style={styles.tag}>
      <Text style={styles.tagTxt}>{txt}</Text>
      <Pressable onPress={onClear} style={{ marginLeft:4 }}>
        <AntDesign name="close" size={11} color="#fff" />
      </Pressable>
    </View>
  );
}

/* sheet block */
function Sheet({ title, opts, val, set }:{
  title:string; opts:string[]; val:string|null; set:(v:string|null)=>void}) {
  return (
    <View style={{ marginTop: 18 }}>
      <Text style={styles.sheetH}>{title}</Text>
      <View style={{ flexDirection:'row', flexWrap:'wrap' }}>
        <Chip label="All" active={val===null} onPress={() => set(null)} />
        {opts.map(o => (
          <Chip key={o} label={o} active={val===o} onPress={() => set(o)} />
        ))}
      </View>
    </View>
  );
}

/* ─── styles (small tweak: chips take full width on narrow screens) ─── */
const styles = StyleSheet.create({
  safe:{ flex:1, backgroundColor:'#f5f6ff' },
  center:{ flex:1, justifyContent:'center', alignItems:'center', backgroundColor:'#f5f6ff' },

  topBar:{ flexDirection:'row', alignItems:'center', justifyContent:'space-between',
           paddingHorizontal:16, paddingVertical:10, backgroundColor: purple },
  topTitle:{ color:'#fff', fontSize:19, fontWeight:'700' },
  iconBtn:{ padding:6, backgroundColor:'rgba(0,0,0,0.15)', borderRadius:14 },

  tagsRow:{ paddingHorizontal:14, marginTop:10 },
  tag:{ flexDirection:'row', alignItems:'center', backgroundColor: purple,
        paddingHorizontal:10, paddingVertical:4, borderRadius:14, marginRight:6 },
  tagTxt:{ color:'#fff', fontSize:13 },

  groupRow:{ flexDirection:'row', flexWrap:'wrap', gap:8,
             paddingHorizontal:14, marginTop:12 },
  chip:{ borderWidth:1, borderColor: purple, borderRadius:18,
         paddingVertical:8, paddingHorizontal:18, flexGrow:1,
         alignItems:'center' },
  chipTxt:{ color: purple, fontSize:13, maxWidth:130 },

  section:{ backgroundColor:'#e6e7ff', padding:6, borderRadius:6,
            color:'#3940a0', fontWeight:'700', marginTop:24 },

  card:{ backgroundColor:'#fff', borderRadius:12, padding:14,
         shadowColor:'#000', shadowOpacity:0.05, shadowRadius:4,
         shadowOffset:{ width:0, height:3 }, ...Platform.select({ android:{ elevation:3 }}) },
  name:{ fontWeight:'600', fontSize:16, color:'#1e1f36' },
  meta:{ color:'#677086', fontSize:12, marginTop:2 },

  sheet:{ flex:1, backgroundColor:'#fff', paddingHorizontal:16 },
  sheetH:{ fontWeight:'700', color:'#32397f', marginBottom:6 },
  done:{ alignSelf:'center', marginVertical:16, backgroundColor: purple,
         paddingHorizontal:40, paddingVertical:12, borderRadius:22 },
});
