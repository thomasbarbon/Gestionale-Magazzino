import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useMemo } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Icon from "@react-native-vector-icons/ionicons";

import { api, Movement, Tire } from "@/src/api";
import { useOperator } from "@/src/operator-context";
import { useResponsive } from "@/src/responsive";
import { makeStyles, radius, spacing, useTheme } from "@/src/theme";

const movementLabel: Record<Movement["type"], string> = {
  create: "Creato",
  add: "Aggiunta",
  remove: "Rimozione",
  delete: "Eliminato",
};

const movementIcon: Record<Movement["type"], string> = {
  create: "add-circle-outline",
  add: "arrow-up-circle-outline",
  remove: "arrow-down-circle-outline",
  delete: "trash-outline",
};

function formatTime(iso: string) {
  try {
    const d = new Date(iso);
    const dd = d.toLocaleDateString("it-IT", { day: "2-digit", month: "short" });
    const hh = d.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
    return `${dd} • ${hh}`;
  } catch {
    return iso;
  }
}

export default function Dashboard() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const styles = useStyles();
  const { colors } = useTheme();
  const { isTablet } = useResponsive();
  const { operator } = useOperator();

  const tiresQ = useQuery({
    queryKey: ["tires"],
    queryFn: api.listTires,
    refetchInterval: 4000,
  });
  const mvsQ = useQuery({
    queryKey: ["movements"],
    queryFn: () => api.listMovements(50),
    refetchInterval: 4000,
  });

  const stats = useMemo(() => {
    const list: Tire[] = tiresQ.data ?? [];
    const totalQty = list.reduce((s, t) => s + t.quantity, 0);
    const uniqueCount = list.length;
    const rims = new Set(list.map((t) => t.rim));
    return { totalQty, uniqueCount, rimCount: rims.size };
  }, [tiresQ.data]);

  const movements = mvsQ.data ?? [];

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]} testID="dashboard-screen">
      <View style={styles.header}>
        <View>
          <Text style={styles.titleSmall}>Autofficina</Text>
          <Text style={styles.title}>Gestionale Gomme</Text>
        </View>
      </View>

      <View style={styles.operatorBar} testID="operator-bar">
        <Icon name="person-circle" size={22} color={colors.brandPrimary} />
        <View style={{ flex: 1 }}>
          <Text style={styles.operatorLabel}>Operatore attivo</Text>
          <Text style={styles.operatorName} testID="operator-name">
            {operator}
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing["2xl"] }}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.statsRow, isTablet && styles.statsRowTablet]}>
          <StatCard
            label="Totale gomme"
            value={String(stats.totalQty)}
            icon="cube-outline"
            tint={colors.brandPrimary}
            testID="stat-total-qty"
          />
          <StatCard
            label="Voci in catalogo"
            value={String(stats.uniqueCount)}
            icon="layers-outline"
            tint={colors.brandSecondary}
            testID="stat-unique-count"
          />
          <StatCard
            label="Pollici diversi"
            value={String(stats.rimCount)}
            icon="disc-outline"
            tint={colors.info}
            testID="stat-rim-count"
          />
        </View>

        <View style={styles.section}>
          <Pressable
            style={styles.magazzinoCard}
            onPress={() => router.push("/(tabs)/magazzino")}
            testID="dashboard-magazzino-card"
          >
            <View style={styles.magazzinoCardIcon}>
              <Icon name="file-tray-stacked" size={28} color={colors.onBrandPrimary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>Magazzino</Text>
              <Text style={styles.cardSub}>
                Gestisci pneumatici per pollice, misura, marchio e stagione
              </Text>
            </View>
            <Icon name="chevron-forward" size={22} color={colors.muted} />
          </Pressable>
        </View>

        <View style={styles.historySection}>
          <View style={styles.historyHeader}>
            <Text style={styles.sectionTitle}>Cronologia movimenti</Text>
            {mvsQ.isFetching ? <ActivityIndicator color={colors.brandPrimary} /> : null}
          </View>

          {mvsQ.isLoading ? (
            <View style={styles.loading}>
              <ActivityIndicator color={colors.brandPrimary} />
            </View>
          ) : movements.length === 0 ? (
            <View style={styles.empty} testID="history-empty">
              <Icon name="time-outline" size={36} color={colors.muted} />
              <Text style={styles.emptyText}>Nessun movimento recente</Text>
              <Text style={styles.emptySub}>
                Le aggiunte, rimozioni e creazioni compariranno qui.
              </Text>
            </View>
          ) : (
            <FlatList
              data={movements}
              scrollEnabled={false}
              keyExtractor={(m) => m.id}
              ItemSeparatorComponent={() => <View style={styles.sep} />}
              renderItem={({ item }) => (
                <View style={styles.mvRow} testID={`movement-row-${item.id}`}>
                  <View
                    style={[
                      styles.mvIcon,
                      {
                        backgroundColor:
                          item.type === "remove" || item.type === "delete"
                            ? "#FEE2E2"
                            : item.type === "create"
                              ? "#DBEAFE"
                              : "#DCFCE7",
                      },
                    ]}
                  >
                    <Icon
                      name={movementIcon[item.type]}
                      size={20}
                      color={
                        item.type === "remove" || item.type === "delete"
                          ? colors.error
                          : item.type === "create"
                            ? colors.brandPrimary
                            : colors.success
                      }
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.mvTitle} numberOfLines={1}>
                      {item.size} — {item.brand}
                    </Text>
                    <Text style={styles.mvSub} numberOfLines={1}>
                      {movementLabel[item.type]} • {item.season} •{" "}
                      {formatTime(item.timestamp)}
                    </Text>
                    <View style={styles.mvOperatorRow}>
                      <Icon name="person-outline" size={11} color={colors.muted} />
                      <Text style={styles.mvOperatorText} numberOfLines={1}>
                        {item.operator ?? "—"}
                      </Text>
                    </View>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text
                      style={[
                        styles.mvDelta,
                        {
                          color: item.delta >= 0 ? colors.success : colors.error,
                        },
                      ]}
                    >
                      {item.delta > 0 ? "+" : ""}
                      {item.delta}
                    </Text>
                    <Text style={styles.mvAfter}>Tot: {item.quantity_after}</Text>
                  </View>
                </View>
              )}
            />
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function StatCard({
  label,
  value,
  icon,
  tint,
  testID,
}: {
  label: string;
  value: string;
  icon: string;
  tint: string;
  testID?: string;
}) {
  const styles = useStyles();
  return (
    <View style={styles.statCard} testID={testID}>
      <View style={[styles.statIcon, { backgroundColor: tint + "22" }]}>
        <Icon name={icon as any} size={20} color={tint} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
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
    justifyContent: "space-between",
  },
  titleSmall: { fontSize: 12, color: colors.muted, fontWeight: "600", textTransform: "uppercase" },
  title: { fontSize: 24, fontWeight: "800", color: colors.onSurface },
  magazzinoBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.brandPrimary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.md,
  },
  magazzinoBtnText: { color: colors.onBrandPrimary, fontWeight: "700", fontSize: 13 },

  operatorBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  operatorLabel: { fontSize: 11, fontWeight: "700", color: colors.muted, textTransform: "uppercase" },
  operatorName: { fontSize: 15, fontWeight: "700", color: colors.onSurface },
  operatorEditBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.brandPrimary,
  },
  operatorEditText: { color: colors.onBrandPrimary, fontSize: 11, fontWeight: "700" },

  statsRow: { flexDirection: "row", gap: spacing.md, flexWrap: "wrap" },
  statsRowTablet: { gap: spacing.lg },
  statCard: {
    flexGrow: 1,
    flexBasis: 150,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.sm,
  },
  statValue: { fontSize: 28, fontWeight: "800", color: colors.onSurface },
  statLabel: { fontSize: 13, color: colors.muted, marginTop: 2 },
  section: { marginTop: spacing.lg },
  magazzinoCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  magazzinoCardIcon: {
    width: 52,
    height: 52,
    borderRadius: radius.md,
    backgroundColor: colors.brandPrimary,
    alignItems: "center",
    justifyContent: "center",
  },
  cardTitle: { fontSize: 17, fontWeight: "700", color: colors.onSurface },
  cardSub: { fontSize: 13, color: colors.muted, marginTop: 2 },
  historySection: { marginTop: spacing.lg },
  historyHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: colors.onSurface },
  loading: { padding: spacing.xl, alignItems: "center" },
  empty: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.xl,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyText: { marginTop: spacing.sm, fontSize: 15, fontWeight: "600", color: colors.onSurface },
  emptySub: {
    fontSize: 13,
    color: colors.muted,
    marginTop: 4,
    textAlign: "center",
  },
  mvRow: {
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: colors.border,
  },
  mvIcon: {
    width: 38,
    height: 38,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  mvTitle: { fontSize: 14, fontWeight: "700", color: colors.onSurface },
  mvSub: { fontSize: 12, color: colors.muted, marginTop: 2 },
  mvOperatorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  mvOperatorText: { fontSize: 11, color: colors.onSurfaceSecondary, fontWeight: "600" },
  mvDelta: { fontSize: 15, fontWeight: "800" },
  mvAfter: { fontSize: 11, color: colors.muted, marginTop: 2 },
  sep: { height: 1, backgroundColor: colors.divider },
}));
