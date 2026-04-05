import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId:   'jp.lifestock.app',
  appName: 'LifeStock',
  webDir:  '.',                   // index.html があるディレクトリ

  // AdMob アプリID は admob-config.json から読み込むが、
  // AndroidManifest.xml にも meta-data として記載が必要（後述）
  plugins: {
    AdMob: {
      // テスト時はこちらのフラグを使用
      // 本番リリース前に admob-config.json の _test_mode を false に変更
    },
  },

  android: {
    // バナー広告のスペース分だけ WebView を上に詰める
    // admob.js 側で position: BOTTOM_CENTER を指定しているため
    // WebView の margin は Capacitor が自動調整
    adjustMarginsForEdgeToEdge: 'dark', // Android 15+ Edge-to-Edge 対応
  },

  server: {
    androidScheme: 'https',
  },
};

export default config;
