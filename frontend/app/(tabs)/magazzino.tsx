import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Icon from "@react-native-vector-icons/ionicons";

import { api, SEASONS, Tire } from "@/src/api";
import { useResponsive } from "@/src/responsive";
import { makeStyles, radius, spacing, useTheme } from "@/src/theme";

const seasonChip = (s: Tire["season"]) =>
  s === "Invernali"
    ? { bg: "#DBEAFE", fg: "#1D4ED8" }
    : s === "Estive"
      ? { bg: "#FFE4CC", fg: "#B45309" }
      : { bg: "#E5E7EB", fg: "#374151" };

export default function Magazzino() {
  const insets = useSafeAreaInsets();
  const styles = useStyles();
  const { colors } = useTheme();
  const qc = useQueryClient();
  const { isTablet } = useResponsive();

  const [search, setSearch] = useState("");
  const [selectedRim, setSelectedRim] = useState<number | "all">("all");
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const [addOpen, setAddOpen] = useState(false);

  const tiresQ = useQuery({ queryKey: ["tires"], queryFn: api.listTires });

  const qtyMut = useMutation({
    mutationFn: ({ id, delta }: { id: string; delta: number }) => api.updateQty(id, delta),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tires"] });
      qc.invalidateQueries({ queryKey: ["movements"] });
    },
  });

  const delMut = useMutation({
    mutationFn: (id: string) => api.deleteTire(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tires"] });
      qc.invalidateQueries({ queryKey: ["movements"] });
    },
  });

  const tires = tiresQ.data ?? [];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tires.filter((t) => {
      if (!q) return true;
      return (
        t.size.toLowerCase().includes(q) ||
        t.brand.toLowerCase().includes(q) ||
        t.season.toLowerCase().includes(q)
      );
    });
  }, [tires, search]);

  const grouped = useMemo(() => {
    const map = new Map<number, Tire[]>();
    for (const t of filtered) {
      if (!map.has(t.rim)) map.set(t.rim, []);
      map.get(t.rim)!.push(t);
    }
    return Array.from(map.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([rim, items]) => ({ rim, items }));
  }, [filtered]);

  const allRims = useMemo(() => {
    const s = new Set(tires.map((t) => t.rim));
    return Array.from(s).sort((a, b) => a - b);
  }, [tires]);

  const visibleGroups = useMemo(() => {
    if (selectedRim === "all") return grouped;
    return grouped.filter((g) => g.rim === selectedRim);
  }, [grouped, selectedRim]);

  const bottomChrome = insets.bottom;

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]} testID="magazzino-screen">
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.titleSmall}>Inventario</Text>
          <Text style={styles.title}>Magazzino</Text>
        </View>
        <Pressable
          style={styles.addBtn}
          onPress={() => setAddOpen(true)}
          testID="open-new-tire-btn"
        >
          <Icon name="add" size={20} color={colors.onBrandPrimary} />
          <Text style={styles.addBtnText}>Nuove gomme</Text>
        </Pressable>
      </View>

      <View style={styles.toolbar}>
        <View style={styles.searchBox}>
          <Icon name="search" size={18} color={colors.muted} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Cerca misura, marchio, stagione..."
            placeholderTextColor={colors.muted}
            style={styles.searchInput}
            testID="search-input"
          />
          {search.length > 0 ? (
            <Pressable onPress={() => setSearch("")} testID="search-clear">
              <Icon name="close-circle" size={18} color={colors.muted} />
            </Pressable>
          ) : null}
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRowContent}
          style={styles.chipRow}
        >
          <Chip
            label="Tutti"
            active={selectedRim === "all"}
            onPress={() => setSelectedRim("all")}
            testID="chip-rim-all"
          />
          {allRims.map((r) => (
            <Chip
              key={r}
              label={`${r}"`}
              active={selectedRim === r}
              onPress={() => setSelectedRim(r)}
              testID={`chip-rim-${r}`}
            />
          ))}
        </ScrollView>
      </View>

      {tiresQ.isLoading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.brandPrimary} />
        </View>
      ) : visibleGroups.length === 0 ? (
        <View style={styles.empty} testID="magazzino-empty">
          <Icon name="cube-outline" size={44} color={colors.muted} />
          <Text style={styles.emptyText}>Nessuna gomma in magazzino</Text>
          <Text style={styles.emptySub}>
            Premi "Nuove gomme" per aggiungere il primo pneumatico.
          </Text>
        </View>
      ) : (
        <FlatList
          data={visibleGroups}
          keyExtractor={(g) => String(g.rim)}
          contentContainerStyle={{
            padding: spacing.lg,
            paddingBottom: bottomChrome + spacing["2xl"],
          }}
          renderItem={({ item: group }) => {
            const isOpen = expanded[group.rim] ?? true;
            const totalQty = group.items.reduce((s, t) => s + t.quantity, 0);
            return (
              <View style={styles.group} testID={`group-rim-${group.rim}`}>
                <Pressable
                  style={styles.groupHeader}
                  onPress={() =>
                    setExpanded((e) => ({ ...e, [group.rim]: !isOpen }))
                  }
                  testID={`group-toggle-${group.rim}`}
                >
                  <View style={styles.groupBadge}>
                    <Text style={styles.groupBadgeText}>{group.rim}"</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.groupTitle}>Cerchio {group.rim}"</Text>
                    <Text style={styles.groupSub}>
                      {group.items.length}{" "}
                      {group.items.length === 1 ? "voce" : "voci"} • {totalQty}{" "}
                      {totalQty === 1 ? "gomma" : "gomme"}
                    </Text>
                  </View>
                  <Icon
                    name={isOpen ? "chevron-up" : "chevron-down"}
                    size={22}
                    color={colors.muted}
                  />
                </Pressable>

                {isOpen ? (
                  <View style={[styles.itemsWrap, isTablet && styles.itemsWrapTablet]}>
                    {group.items.map((t) => {
                      const chip = seasonChip(t.season);
                      return (
                        <View
                          key={t.id}
                          style={[styles.item, isTablet && styles.itemTablet]}
                          testID={`tire-row-${t.id}`}
                        >
                          <View style={{ flex: 1 }}>
                            <Text style={styles.itemSize}>{t.size}</Text>
                            <View style={styles.itemMetaRow}>
                              <Text style={styles.itemBrand}>{t.brand}</Text>
                              <View
                                style={[styles.seasonChip, { backgroundColor: chip.bg }]}
                              >
                                <Text style={[styles.seasonChipText, { color: chip.fg }]}>
                                  {t.season}
                                </Text>
                              </View>
                            </View>
                          </View>

                          <View style={styles.qtyBox}>
                            <Pressable
                              style={styles.qtyBtn}
                              onPress={() =>
                                qtyMut.mutate({ id: t.id, delta: -1 })
                              }
                              disabled={t.quantity <= 0}
                              testID={`qty-dec-${t.id}`}
                            >
                              <Icon
                                name="remove"
                                size={18}
                                color={
                                  t.quantity <= 0 ? colors.muted : colors.onSurface
                                }
                              />
                            </Pressable>
                            <Text style={styles.qtyValue} testID={`qty-value-${t.id}`}>
                              {t.quantity}
                            </Text>
                            <Pressable
                              style={styles.qtyBtn}
                              onPress={() => qtyMut.mutate({ id: t.id, delta: 1 })}
                              testID={`qty-inc-${t.id}`}
                            >
                              <Icon name="add" size={18} color={colors.onSurface} />
                            </Pressable>
                          </View>

                          <Pressable
                            style={styles.deleteBtn}
                            onPress={() => delMut.mutate(t.id)}
                            testID={`delete-tire-${t.id}`}
                            hitSlop={8}
                          >
                            <Icon name="trash-outline" size={18} color={colors.error} />
                          </Pressable>
                        </View>
                      );
                    })}
                  </View>
                ) : null}
              </View>
            );
          }}
        />
      )}

      <AddTireModal
        visible={addOpen}
        onClose={() => setAddOpen(false)}
        onSuccess={() => {
          qc.invalidateQueries({ queryKey: ["tires"] });
          qc.invalidateQueries({ queryKey: ["movements"] });
        }}
      />
    </View>
  );
}

function Chip({
  label,
  active,
  onPress,
  testID,
}: {
  label: string;
  active?: boolean;
  onPress?: () => void;
  testID?: string;
}) {
  const styles = useStyles();
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, active && styles.chipActive]}
      testID={testID}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

function AddTireModal({
  visible,
  onClose,
  onSuccess,
}: {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { isTablet } = useResponsive();

  const metaQ = useQuery({ queryKey: ["meta"], queryFn: api.getMeta });
  const brands = metaQ.data?.brands ?? [];

  const [size, setSize] = useState("");
  const [brand, setBrand] = useState<string | null>(null);
  const [season, setSeason] = useState<Tire["season"] | null>(null);
  const [quantity, setQuantity] = useState("1");
  const [brandOpen, setBrandOpen] = useState(false);
  const [seasonOpen, setSeasonOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createMut = useMutation({
    mutationFn: api.createTire,
    onSuccess: () => {
      onSuccess();
      reset();
      onClose();
    },
    onError: (e: Error) => setError(e.message),
  });

  function reset() {
    setSize("");
    setBrand(null);
    setSeason(null);
    setQuantity("1");
    setError(null);
    setBrandOpen(false);
    setSeasonOpen(false);
  }

  function submit() {
    setError(null);
    const q = parseInt(quantity, 10);
    if (!size.trim()) return setError("Inserisci la sigla/misura");
    if (!brand) return setError("Seleziona il marchio");
    if (!season) return setError("Seleziona la stagione");
    if (!q || q < 1) return setError("La quantità deve essere almeno 1");
    createMut.mutate({ size: size.trim(), brand, season, quantity: q });
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.modalBackdrop}>
        <View
          style={[
            styles.modalCard,
            isTablet && styles.modalCardTablet,
            { paddingBottom: Math.max(insets.bottom, spacing.lg) },
          ]}
        >
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Nuove gomme</Text>
            <Pressable onPress={onClose} testID="close-add-modal" hitSlop={8}>
              <Icon name="close" size={24} color={colors.onSurface} />
            </Pressable>
          </View>

          <KeyboardAwareScrollView
            bottomOffset={spacing.lg}
            style={{ flex: 1 }}
            contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}
            keyboardShouldPersistTaps="handled"
          >
            <Field label="Sigla / Misura">
              <TextInput
                value={size}
                onChangeText={setSize}
                placeholder="es. 185/60 R15 91V"
                placeholderTextColor={colors.muted}
                style={styles.input}
                autoCapitalize="characters"
                testID="input-size"
              />
            </Field>

            <Field label="Marchio">
              <Pressable
                style={styles.selectBtn}
                onPress={() => {
                  setBrandOpen((v) => !v);
                  setSeasonOpen(false);
                }}
                testID="brand-select"
              >
                <Text style={[styles.selectText, !brand && { color: colors.muted }]}>
                  {brand ?? "Seleziona un marchio"}
                </Text>
                <Icon
                  name={brandOpen ? "chevron-up" : "chevron-down"}
                  size={18}
                  color={colors.muted}
                />
              </Pressable>
              {brandOpen ? (
                <View style={styles.dropdown}>
                  <ScrollView style={{ maxHeight: 240 }} nestedScrollEnabled>
                    {brands.map((b) => (
                      <Pressable
                        key={b}
                        style={[styles.option, brand === b && styles.optionActive]}
                        onPress={() => {
                          setBrand(b);
                          setBrandOpen(false);
                        }}
                        testID={`brand-option-${b}`}
                      >
                        <Text
                          style={[
                            styles.optionText,
                            brand === b && { color: colors.brandPrimary, fontWeight: "700" },
                          ]}
                        >
                          {b}
                        </Text>
                        {brand === b ? (
                          <Icon name="checkmark" size={18} color={colors.brandPrimary} />
                        ) : null}
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>
              ) : null}
            </Field>

            <Field label="Stagione">
              <Pressable
                style={styles.selectBtn}
                onPress={() => {
                  setSeasonOpen((v) => !v);
                  setBrandOpen(false);
                }}
                testID="season-select"
              >
                <Text style={[styles.selectText, !season && { color: colors.muted }]}>
                  {season ?? "Seleziona una stagione"}
                </Text>
                <Icon
                  name={seasonOpen ? "chevron-up" : "chevron-down"}
                  size={18}
                  color={colors.muted}
                />
              </Pressable>
              {seasonOpen ? (
                <View style={styles.dropdown}>
                  {SEASONS.map((s) => (
                    <Pressable
                      key={s}
                      style={[styles.option, season === s && styles.optionActive]}
                      onPress={() => {
                        setSeason(s);
                        setSeasonOpen(false);
                      }}
                      testID={`season-option-${s}`}
                    >
                      <Text
                        style={[
                          styles.optionText,
                          season === s && { color: colors.brandPrimary, fontWeight: "700" },
                        ]}
                      >
                        {s}
                      </Text>
                      {season === s ? (
                        <Icon name="checkmark" size={18} color={colors.brandPrimary} />
                      ) : null}
                    </Pressable>
                  ))}
                </View>
              ) : null}
            </Field>

            <Field label="Quantità">
              <TextInput
                value={quantity}
                onChangeText={(v) => setQuantity(v.replace(/[^0-9]/g, ""))}
                keyboardType={Platform.OS === "ios" ? "number-pad" : "numeric"}
                style={styles.input}
                testID="input-quantity"
              />
            </Field>

            {error ? (
              <Text style={styles.errorText} testID="form-error">
                {error}
              </Text>
            ) : null}

            <Pressable
              style={[styles.submitBtn, createMut.isPending && { opacity: 0.6 }]}
              onPress={submit}
              disabled={createMut.isPending}
              testID="submit-new-tire"
            >
              {createMut.isPending ? (
                <ActivityIndicator color={colors.onBrandPrimary} />
              ) : (
                <>
                  <Icon name="save-outline" size={18} color={colors.onBrandPrimary} />
                  <Text style={styles.submitBtnText}>Salva</Text>
                </>
              )}
            </Pressable>
          </KeyboardAwareScrollView>
        </View>
      </View>
    </Modal>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  const styles = useStyles();
  return (
    <View style={{ gap: spacing.xs }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  screen: { flex: 1, backgroundColor: colors.surfaceSecondary },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  titleSmall: { fontSize: 12, color: colors.muted, fontWeight: "600", textTransform: "uppercase" },
  title: { fontSize: 24, fontWeight: "800", color: colors.onSurface },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.brandSecondary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.md,
  },
  addBtnText: { color: colors.onBrandSecondary, fontWeight: "700", fontSize: 13 },

  toolbar: {
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.sm,
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchInput: { flex: 1, fontSize: 15, color: colors.onSurface, outlineStyle: "none" as any },
  chipRow: { marginTop: 2 },
  chipRowContent: { gap: 8, paddingRight: spacing.md },
  chip: {
    flexShrink: 0,
    height: 36,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  chipActive: {
    backgroundColor: colors.brandPrimary,
    borderColor: colors.brandPrimary,
  },
  chipText: { fontSize: 13, fontWeight: "600", color: colors.onSurfaceSecondary },
  chipTextActive: { color: colors.onBrandPrimary },

  loading: { padding: spacing.xl, alignItems: "center" },
  empty: {
    margin: spacing.lg,
    padding: spacing.xl,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
  },
  emptyText: { marginTop: spacing.sm, fontSize: 16, fontWeight: "700", color: colors.onSurface },
  emptySub: { fontSize: 13, color: colors.muted, marginTop: 4, textAlign: "center" },

  group: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
    overflow: "hidden",
  },
  groupHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.md,
  },
  groupBadge: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.brandTertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  groupBadgeText: { color: colors.onBrandTertiary, fontWeight: "800", fontSize: 16 },
  groupTitle: { fontSize: 16, fontWeight: "700", color: colors.onSurface },
  groupSub: { fontSize: 12, color: colors.muted, marginTop: 2 },

  itemsWrap: { paddingHorizontal: spacing.md, paddingBottom: spacing.md, gap: spacing.sm },
  itemsWrapTablet: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
  },
  itemTablet: {
    flexBasis: "48%",
    flexGrow: 1,
    marginRight: spacing.sm,
    marginBottom: spacing.sm,
  },
  itemSize: { fontSize: 15, fontWeight: "700", color: colors.onSurface },
  itemMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: 4,
    flexWrap: "wrap",
  },
  itemBrand: { fontSize: 13, color: colors.onSurfaceSecondary, fontWeight: "600" },
  seasonChip: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  seasonChipText: { fontSize: 11, fontWeight: "700" },

  qtyBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 4,
  },
  qtyBtn: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  qtyValue: {
    minWidth: 28,
    textAlign: "center",
    fontSize: 15,
    fontWeight: "800",
    color: colors.onSurface,
  },
  deleteBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
  },

  // Modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    height: "92%",
  },
  modalCardTablet: {
    alignSelf: "center",
    width: 560,
    maxWidth: "96%",
    borderRadius: radius.lg,
    marginBottom: "4%",
    height: "88%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: { fontSize: 18, fontWeight: "800", color: colors.onSurface },

  fieldLabel: { fontSize: 13, fontWeight: "700", color: colors.onSurfaceSecondary },
  input: {
    height: 46,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    fontSize: 15,
    color: colors.onSurface,
    outlineStyle: "none" as any,
  },
  selectBtn: {
    height: 46,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  selectText: { fontSize: 15, color: colors.onSurface, fontWeight: "600" },
  dropdown: {
    marginTop: 4,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  option: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  optionActive: { backgroundColor: colors.brandTertiary },
  optionText: { fontSize: 14, color: colors.onSurface },

  errorText: {
    color: colors.error,
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
  },
  submitBtn: {
    marginTop: spacing.sm,
    height: 50,
    borderRadius: radius.md,
    backgroundColor: colors.brandPrimary,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  submitBtnText: { color: colors.onBrandPrimary, fontWeight: "800", fontSize: 15 },
}));
