import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  ActivityIndicator,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Icon from "@react-native-vector-icons/ionicons";

import { storage } from "@/src/utils/storage";
import { makeStyles, radius, spacing, useTheme } from "@/src/theme";

const OPERATOR_KEY = "gommagest.operator.name";

type OperatorCtx = {
  operator: string | null;
  loading: boolean;
  setOperator: (name: string) => Promise<void>;
};

const Ctx = createContext<OperatorCtx | null>(null);

export function useOperator(): OperatorCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error("useOperator must be used inside <OperatorProvider>");
  return v;
}

// Persist the operator name in BOTH the secure store (Keychain on iOS /
// EncryptedSharedPreferences on Android, persists across app relaunches and
// re-installs) and AsyncStorage (fallback / web). Reading tries both so a
// missing value in one surface is recovered from the other.
async function readOperator(): Promise<string | null> {
  const [secure, async] = await Promise.all([
    storage.secureGet<string>(OPERATOR_KEY, ""),
    storage.getItem<string>(OPERATOR_KEY, ""),
  ]);
  const name = (secure && secure.trim()) || (async && async.trim()) || "";
  return name ? name : null;
}

async function writeOperator(name: string) {
  await Promise.all([
    storage.secureSet(OPERATOR_KEY, name),
    storage.setItem(OPERATOR_KEY, name),
  ]);
}

export function OperatorProvider({ children }: { children: React.ReactNode }) {
  const [operator, setOp] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const saved = await readOperator();
      if (saved) setOp(saved);
      setLoading(false);
    })();
  }, []);

  const setOperator = useCallback(async (name: string) => {
    const clean = name.trim();
    if (!clean) return;
    await writeOperator(clean);
    // Re-read to confirm the write actually landed before switching screens.
    const confirmed = (await readOperator()) ?? clean;
    setOp(confirmed);
  }, []);

  const value = useMemo<OperatorCtx>(
    () => ({ operator, loading, setOperator }),
    [operator, loading, setOperator],
  );

  return (
    <Ctx.Provider value={value}>
      {loading ? (
        <LoadingScreen />
      ) : operator ? (
        children
      ) : (
        <WelcomeScreen onDone={setOperator} />
      )}
    </Ctx.Provider>
  );
}

function LoadingScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.center} testID="operator-loading">
      <ActivityIndicator color={colors.brandPrimary} />
    </View>
  );
}

function WelcomeScreen({ onDone }: { onDone: (name: string) => Promise<void> }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    if (name.trim().length < 2) {
      setError("Inserisci un nome valido (min 2 caratteri)");
      return;
    }
    setSubmitting(true);
    try {
      await onDone(name.trim());
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View
      style={[
        styles.welcome,
        { paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.lg },
      ]}
      testID="welcome-screen"
    >
      <View style={styles.welcomeInner}>
        <View style={styles.welcomeIcon}>
          <Icon name="person-circle-outline" size={56} color={colors.onBrandPrimary} />
        </View>
        <Text style={styles.welcomeTitle}>Benvenuto in Gestionale Gomme</Text>
        <Text style={styles.welcomeSub}>
          Prima di iniziare, inserisci il tuo nome. Verrà registrato nella cronologia dei
          movimenti per sapere chi effettua le modifiche al magazzino.
        </Text>
        <Text style={styles.fieldLabel}>Nome operatore</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="es. Marco Rossi"
          placeholderTextColor={colors.muted}
          style={styles.input}
          autoCapitalize="words"
          autoFocus
          returnKeyType="done"
          onSubmitEditing={submit}
          testID="welcome-name-input"
        />
        {error ? (
          <Text style={styles.errorText} testID="welcome-error">
            {error}
          </Text>
        ) : null}
        <Pressable
          style={[styles.primaryBtn, submitting && { opacity: 0.6 }]}
          onPress={submit}
          disabled={submitting}
          testID="welcome-submit"
        >
          {submitting ? (
            <ActivityIndicator color={colors.onBrandPrimary} />
          ) : (
            <>
              <Icon name="arrow-forward" size={18} color={colors.onBrandPrimary} />
              <Text style={styles.primaryBtnText}>Entra</Text>
            </>
          )}
        </Pressable>
        <Text style={styles.helperText}>
          Il nome verrà memorizzato su questo dispositivo e usato automaticamente ai prossimi
          avvii dell'app.
        </Text>
      </View>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface },
  welcome: { flex: 1, backgroundColor: colors.surfaceSecondary, paddingHorizontal: spacing.lg },
  welcomeInner: {
    flex: 1,
    maxWidth: 480,
    alignSelf: "center",
    width: "100%",
    justifyContent: "center",
    gap: spacing.md,
  },
  welcomeIcon: {
    width: 86,
    height: 86,
    borderRadius: radius.pill,
    backgroundColor: colors.brandPrimary,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginBottom: spacing.sm,
  },
  welcomeTitle: {
    fontSize: 26,
    fontWeight: "800",
    color: colors.onSurface,
    textAlign: "center",
  },
  welcomeSub: {
    fontSize: 14,
    color: colors.muted,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: spacing.md,
  },
  fieldLabel: { fontSize: 13, fontWeight: "700", color: colors.onSurfaceSecondary },
  input: {
    height: 50,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    fontSize: 16,
    color: colors.onSurface,
    outlineStyle: "none" as any,
  },
  primaryBtn: {
    height: 50,
    borderRadius: radius.md,
    backgroundColor: colors.brandPrimary,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  primaryBtnText: { color: colors.onBrandPrimary, fontWeight: "800", fontSize: 15 },
  errorText: { color: colors.error, fontSize: 13, fontWeight: "600", textAlign: "center" },
  helperText: {
    fontSize: 12,
    color: colors.muted,
    textAlign: "center",
    marginTop: spacing.md,
  },
}));
