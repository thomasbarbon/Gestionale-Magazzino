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
  Modal,
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
  clearOperator: () => Promise<void>;
  openEditor: () => void;
};

const Ctx = createContext<OperatorCtx | null>(null);

export function useOperator(): OperatorCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error("useOperator must be used inside <OperatorProvider>");
  return v;
}

export function OperatorProvider({ children }: { children: React.ReactNode }) {
  const [operator, setOp] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [editorOpen, setEditorOpen] = useState(false);

  useEffect(() => {
    (async () => {
      const saved = await storage.getItem<string>(OPERATOR_KEY, "");
      if (saved && typeof saved === "string" && saved.trim().length > 0) {
        setOp(saved);
      }
      setLoading(false);
    })();
  }, []);

  const setOperator = useCallback(async (name: string) => {
    const clean = name.trim();
    if (!clean) return;
    await storage.setItem(OPERATOR_KEY, clean);
    setOp(clean);
  }, []);

  const clearOperator = useCallback(async () => {
    await storage.removeItem(OPERATOR_KEY);
    setOp(null);
  }, []);

  const openEditor = useCallback(() => setEditorOpen(true), []);

  const value = useMemo<OperatorCtx>(
    () => ({ operator, loading, setOperator, clearOperator, openEditor }),
    [operator, loading, setOperator, clearOperator, openEditor],
  );

  return (
    <Ctx.Provider value={value}>
      {loading ? <LoadingScreen /> : operator ? children : <WelcomeScreen onDone={setOperator} />}
      <ChangeOperatorModal
        visible={editorOpen && !!operator}
        current={operator ?? ""}
        onClose={() => setEditorOpen(false)}
        onSave={async (name) => {
          await setOperator(name);
          setEditorOpen(false);
        }}
      />
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
        <Text style={styles.welcomeTitle}>Benvenuto in GommaGest</Text>
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
          avvii. Puoi cambiarlo in qualsiasi momento dalla Dashboard.
        </Text>
      </View>
    </View>
  );
}

function ChangeOperatorModal({
  visible,
  current,
  onClose,
  onSave,
}: {
  visible: boolean;
  current: string;
  onClose: () => void;
  onSave: (name: string) => Promise<void>;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [name, setName] = useState(current);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setName(current);
      setError(null);
    }
  }, [visible, current]);

  async function submit() {
    if (name.trim().length < 2) {
      setError("Nome troppo corto");
      return;
    }
    await onSave(name);
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View
          style={[
            styles.modalCard,
            { marginBottom: Math.max(insets.bottom, spacing.lg) },
          ]}
        >
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Cambia operatore</Text>
            <Pressable onPress={onClose} testID="close-change-operator" hitSlop={8}>
              <Icon name="close" size={22} color={colors.onSurface} />
            </Pressable>
          </View>
          <View style={{ padding: spacing.lg, gap: spacing.md }}>
            <Text style={styles.fieldLabel}>Nome operatore</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Nome e cognome"
              placeholderTextColor={colors.muted}
              style={styles.input}
              autoCapitalize="words"
              testID="change-operator-input"
            />
            {error ? (
              <Text style={styles.errorText} testID="change-operator-error">
                {error}
              </Text>
            ) : null}
            <Pressable style={styles.primaryBtn} onPress={submit} testID="change-operator-save">
              <Icon name="save-outline" size={18} color={colors.onBrandPrimary} />
              <Text style={styles.primaryBtnText}>Salva</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
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

  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    marginHorizontal: spacing.lg,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: { fontSize: 17, fontWeight: "800", color: colors.onSurface },
}));
