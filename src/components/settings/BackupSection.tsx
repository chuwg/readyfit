import React, { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Card } from '../Card';
import { exportToFile, pickAndImport } from '../../services/backup';
import { colors, radius, spacing } from '../../theme/colors';

interface Props {
  onAfterImport?: () => void;
}

export function BackupSection({ onAfterImport }: Props) {
  const [busy, setBusy] = useState<'export' | 'import' | null>(null);

  const handleExport = async () => {
    if (busy) return;
    setBusy('export');
    try {
      const result = await exportToFile();
      if (!result.shared) {
        Alert.alert(
          '내보내기 완료',
          `파일이 임시 저장됐지만 공유 기능을 사용할 수 없는 환경입니다.\n경로: ${result.fileUri}`,
        );
      }
    } catch (e: any) {
      Alert.alert('내보내기 실패', e?.message ?? '알 수 없는 오류');
    } finally {
      setBusy(null);
    }
  };

  const handleImport = async () => {
    if (busy) return;
    Alert.alert(
      '데이터 가져오기',
      '백업 파일의 모든 데이터로 현재 데이터를 덮어씁니다. 계속할까요?',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '계속',
          style: 'destructive',
          onPress: async () => {
            setBusy('import');
            try {
              const summary = await pickAndImport();
              const total = Object.values(summary.tables).reduce(
                (a, b) => a + b,
                0,
              );
              const at = summary.exportedAt
                ? new Date(summary.exportedAt).toLocaleString('ko-KR')
                : '';
              Alert.alert(
                '복원 완료',
                `${total}개 레코드를 가져왔습니다.${at ? `\n원본: ${at}` : ''}`,
              );
              onAfterImport?.();
            } catch (e: any) {
              if (e?.message === 'CANCELED') {
                // user canceled — ignore
              } else if (e?.message === 'INVALID_FORMAT') {
                Alert.alert('형식 오류', '레디핏 백업 파일이 아닙니다.');
              } else if (e?.message === 'VERSION_TOO_NEW') {
                Alert.alert(
                  '버전 호환 안 됨',
                  '백업 파일이 이 앱 버전보다 새롭습니다. 앱을 업데이트해주세요.',
                );
              } else {
                Alert.alert(
                  '복원 실패',
                  e?.message ?? '파일을 처리하는 중 오류가 발생했습니다.',
                );
              }
            } finally {
              setBusy(null);
            }
          },
        },
      ],
    );
  };

  return (
    <Card title="데이터 백업">
      <Text style={styles.hint}>
        모든 운동·인바디·설정 데이터를 JSON 파일로 내보내거나 가져옵니다. 폰을 바꾸거나 데이터를 옮길 때 사용하세요.
      </Text>
      <View style={styles.row}>
        <Pressable
          onPress={handleExport}
          disabled={busy !== null}
          style={[styles.btn, styles.btnPrimary, busy && styles.btnDisabled]}
        >
          {busy === 'export' ? (
            <ActivityIndicator color={colors.bg} size="small" />
          ) : (
            <Text style={styles.btnPrimaryText}>내보내기</Text>
          )}
        </Pressable>
        <Pressable
          onPress={handleImport}
          disabled={busy !== null}
          style={[styles.btn, styles.btnGhost, busy && styles.btnDisabled]}
        >
          {busy === 'import' ? (
            <ActivityIndicator color={colors.text} size="small" />
          ) : (
            <Text style={styles.btnGhostText}>가져오기</Text>
          )}
        </Pressable>
      </View>
      <Text style={styles.note}>
        가져오기는 현재 데이터를 모두 덮어씁니다. 먼저 내보내기로 백업해두세요.
      </Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  hint: {
    color: colors.textDim,
    fontSize: 12,
    lineHeight: 18,
    marginBottom: spacing.md,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  btn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: radius.sm,
  },
  btnPrimary: {
    backgroundColor: colors.mint,
  },
  btnPrimaryText: {
    color: colors.bg,
    fontSize: 14,
    fontWeight: '700',
  },
  btnGhost: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
  },
  btnGhostText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  btnDisabled: {
    opacity: 0.5,
  },
  note: {
    color: colors.textMuted,
    fontSize: 11,
    marginTop: spacing.sm,
    lineHeight: 16,
  },
});
