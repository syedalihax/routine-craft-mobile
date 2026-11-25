import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors } from '../constants/colors';
import { useAuth } from '../context/AuthContext';
import { authAPI } from '../services/api';

export default function AuthScreen() {
  const { themeMode, login, register } = useAuth();
  const colors = Colors[themeMode === 'LIGHT' ? 'light' : 'dark'];

  const [mode, setMode] = useState('signIn'); // signIn | signUp | forgot | reset
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [infoMessage, setInfoMessage] = useState('');

  const isSignUp = mode === 'signUp';
  const isAuthMode = mode === 'signIn' || mode === 'signUp';

  const clearMessages = () => {
    setErrorMessage('');
    setInfoMessage('');
  };

  const switchMode = (nextMode) => {
    setMode(nextMode);
    clearMessages();
    setPassword('');
    setNewPassword('');
    setResetCode('');
    setShowPassword(false);
    setShowNewPassword(false);
  };

  const handleAuthSubmit = async () => {
    clearMessages();
    if (!email || !password || (isSignUp && !name)) {
      setErrorMessage('Please fill in all required fields');
      return;
    }

    setLoading(true);
    try {
      if (isSignUp) {
        await register(name.trim(), email.trim(), password);
      } else {
        await login(email.trim(), password);
      }
    } catch (err) {
      setErrorMessage(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    clearMessages();
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setErrorMessage('Please enter your email address');
      return;
    }

    setLoading(true);
    try {
      const res = await authAPI.forgotPassword(trimmedEmail);
      setInfoMessage(
        res?.data?.message ||
          'If an account with that email exists, a password reset code has been sent.'
      );
      setMode('reset');
    } catch (err) {
      setErrorMessage(err.message || 'Failed to send reset code');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    clearMessages();
    const trimmedEmail = email.trim();
    const trimmedCode = resetCode.trim();

    if (!trimmedEmail || !trimmedCode || !newPassword) {
      setErrorMessage('Please fill in all required fields');
      return;
    }
    if (!/^\d{6}$/.test(trimmedCode)) {
      setErrorMessage('Verification code must be 6 digits');
      return;
    }
    if (newPassword.length < 6) {
      setErrorMessage('New password must be at least 6 characters');
      return;
    }

    setLoading(true);
    try {
      const res = await authAPI.resetPassword(trimmedEmail, trimmedCode, newPassword);
      setInfoMessage(res?.data?.message || 'Password reset successful. Please sign in.');
      setMode('signIn');
      setPassword('');
      setNewPassword('');
      setResetCode('');
      setShowPassword(false);
      setShowNewPassword(false);
    } catch (err) {
      setErrorMessage(err.message || 'Failed to reset password');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = () => {
    if (mode === 'forgot') return handleForgotPassword();
    if (mode === 'reset') return handleResetPassword();
    return handleAuthSubmit();
  };

  const title =
    mode === 'forgot'
      ? 'Forgot Password'
      : mode === 'reset'
        ? 'Reset Password'
        : 'RoutineCraft';
  const subtitle =
    mode === 'forgot'
      ? 'Enter your email to receive a verification code'
      : mode === 'reset'
        ? 'Enter the code sent to your email and set a new password'
        : 'Binance-Style Daily Habit & Consistency Tracker';

  const submitLabel =
    mode === 'forgot'
      ? 'Send Reset Code'
      : mode === 'reset'
        ? 'Reset Password'
        : isSignUp
          ? 'Create Account'
          : 'Sign In';

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.brandContainer}>
          <View style={[styles.logoIcon, { backgroundColor: colors.primary }]}>
            <MaterialIcons
              name={mode === 'forgot' || mode === 'reset' ? 'lock-reset' : 'insights'}
              size={32}
              color="#FFFFFF"
            />
          </View>
          <Text style={[styles.brandTitle, { color: colors.text }]}>{title}</Text>
          <Text style={[styles.brandTagline, { color: colors.textSecondary }]}>{subtitle}</Text>
        </View>

        {isAuthMode && (
          <View style={[styles.tabBar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <TouchableOpacity
              style={[styles.tabBtn, !isSignUp && { backgroundColor: colors.surfaceElevated }]}
              onPress={() => switchMode('signIn')}
            >
              <Text style={[styles.tabText, { color: !isSignUp ? colors.primary : colors.textSecondary }]}>
                Sign In
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabBtn, isSignUp && { backgroundColor: colors.surfaceElevated }]}
              onPress={() => switchMode('signUp')}
            >
              <Text style={[styles.tabText, { color: isSignUp ? colors.primary : colors.textSecondary }]}>
                Register
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {errorMessage ? (
          <View style={[styles.messageBox, { backgroundColor: colors.dangerLight }]}>
            <MaterialIcons name="error-outline" size={18} color={colors.danger} />
            <Text style={[styles.messageText, { color: colors.danger }]}>{errorMessage}</Text>
          </View>
        ) : null}

        {infoMessage ? (
          <View
            style={[
              styles.messageBox,
              {
                backgroundColor: colors.successLight || colors.surfaceElevated,
                borderWidth: 1,
                borderColor: colors.success || colors.primary,
              },
            ]}
          >
            <MaterialIcons name="check-circle-outline" size={18} color={colors.success || colors.primary} />
            <Text style={[styles.messageText, { color: colors.success || colors.primary }]}>{infoMessage}</Text>
          </View>
        ) : null}

        <View style={styles.form}>
          {isSignUp && (
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Full Name</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
                placeholder="e.g. John Doe"
                placeholderTextColor={colors.textMuted}
                value={name}
                onChangeText={setName}
              />
            </View>
          )}

          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Email Address</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
              placeholder="name@example.com"
              placeholderTextColor={colors.textMuted}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          {isAuthMode && (
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Password</Text>
              <View style={[styles.passwordWrap, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <TextInput
                  style={[styles.passwordInput, { color: colors.text }]}
                  placeholder="••••••••"
                  placeholderTextColor={colors.textMuted}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                />
                <TouchableOpacity
                  onPress={() => setShowPassword((v) => !v)}
                  style={styles.eyeBtn}
                  accessibilityRole="button"
                  accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                >
                  <MaterialIcons
                    name={showPassword ? 'visibility-off' : 'visibility'}
                    size={22}
                    color={colors.textSecondary}
                  />
                </TouchableOpacity>
              </View>
            </View>
          )}

          {mode === 'signIn' && (
            <TouchableOpacity onPress={() => switchMode('forgot')} style={styles.forgotBtn}>
              <Text style={[styles.forgotText, { color: colors.primary }]}>Forgot Password?</Text>
            </TouchableOpacity>
          )}

          {mode === 'reset' && (
            <>
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Verification Code</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
                  placeholder="6-digit code"
                  placeholderTextColor={colors.textMuted}
                  value={resetCode}
                  onChangeText={setResetCode}
                  keyboardType="number-pad"
                  maxLength={6}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>New Password</Text>
                <View style={[styles.passwordWrap, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <TextInput
                    style={[styles.passwordInput, { color: colors.text }]}
                    placeholder="At least 6 characters"
                    placeholderTextColor={colors.textMuted}
                    value={newPassword}
                    onChangeText={setNewPassword}
                    secureTextEntry={!showNewPassword}
                    autoCapitalize="none"
                  />
                  <TouchableOpacity
                    onPress={() => setShowNewPassword((v) => !v)}
                    style={styles.eyeBtn}
                    accessibilityRole="button"
                    accessibilityLabel={showNewPassword ? 'Hide new password' : 'Show new password'}
                  >
                    <MaterialIcons
                      name={showNewPassword ? 'visibility-off' : 'visibility'}
                      size={22}
                      color={colors.textSecondary}
                    />
                  </TouchableOpacity>
                </View>
              </View>
            </>
          )}

          <TouchableOpacity
            style={[styles.submitBtn, { backgroundColor: colors.primary }, loading && styles.submitBtnDisabled]}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.submitBtnText}>{submitLabel}</Text>
            )}
          </TouchableOpacity>

          {!isAuthMode && (
            <TouchableOpacity
              onPress={() => switchMode('signIn')}
              style={styles.backBtn}
              disabled={loading}
            >
              <Text style={[styles.backBtnText, { color: colors.textSecondary }]}>
                Back to <Text style={{ color: colors.primary, fontWeight: '700' }}>Sign In</Text>
              </Text>
            </TouchableOpacity>
          )}

          {mode === 'reset' && (
            <TouchableOpacity
              onPress={handleForgotPassword}
              style={styles.backBtn}
              disabled={loading}
            >
              <Text style={[styles.backBtnText, { color: colors.primary }]}>Resend code</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 24,
    justifyContent: 'center',
  },
  brandContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logoIcon: {
    width: 64,
    height: 64,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  brandTitle: {
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  brandTagline: {
    fontSize: 13,
    marginTop: 6,
    textAlign: 'center',
  },
  tabBar: {
    flexDirection: 'row',
    borderRadius: 12,
    borderWidth: 1,
    padding: 4,
    marginBottom: 20,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '700',
  },
  messageBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    marginBottom: 16,
  },
  messageText: {
    fontSize: 13,
    marginLeft: 8,
    flex: 1,
  },
  form: {
    width: '100%',
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    height: 48,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 15,
  },
  passwordWrap: {
    height: 48,
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 14,
  },
  passwordInput: {
    flex: 1,
    height: '100%',
    fontSize: 15,
  },
  eyeBtn: {
    paddingHorizontal: 12,
    height: '100%',
    justifyContent: 'center',
  },
  forgotBtn: {
    alignSelf: 'flex-end',
    marginTop: -6,
    marginBottom: 8,
    paddingVertical: 4,
  },
  forgotText: {
    fontSize: 13,
    fontWeight: '600',
  },
  submitBtn: {
    height: 50,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  submitBtnDisabled: {
    opacity: 0.7,
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  backBtn: {
    marginTop: 16,
    alignItems: 'center',
    paddingVertical: 4,
  },
  backBtnText: {
    fontSize: 14,
  },
});
