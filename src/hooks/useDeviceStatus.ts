import { useEffect, useState } from 'react';

interface NetworkConnection extends EventTarget {
  effectiveType?: 'slow-2g' | '2g' | '3g' | '4g';
  downlink?: number;
  rtt?: number;
  type?: string;
}

interface BatteryManager extends EventTarget {
  charging: boolean;
  level: number;
}

export interface DeviceStatus {
  online: boolean;
  signalBars: 0 | 1 | 2 | 3 | 4;
  signalLabel: string;
  battery: {
    levelPct: number;
    charging: boolean;
  } | null;
}

function getNetworkConnection(): NetworkConnection | null {
  if (typeof navigator === 'undefined') return null;
  const nav = navigator as Navigator & {
    connection?: NetworkConnection;
    mozConnection?: NetworkConnection;
    webkitConnection?: NetworkConnection;
  };
  return nav.connection ?? nav.mozConnection ?? nav.webkitConnection ?? null;
}

function readNetworkSignal(): Pick<DeviceStatus, 'online' | 'signalBars' | 'signalLabel'> {
  if (typeof navigator === 'undefined') {
    return { online: true, signalBars: 4, signalLabel: 'Online' };
  }

  const online = navigator.onLine !== false;
  if (!online) {
    return { online: false, signalBars: 0, signalLabel: 'Offline' };
  }

  const conn = getNetworkConnection();
  if (!conn) {
    return { online: true, signalBars: 4, signalLabel: 'Online' };
  }

  const eff = conn.effectiveType;
  const downlink = typeof conn.downlink === 'number' ? conn.downlink : null;
  const rtt = typeof conn.rtt === 'number' ? conn.rtt : null;

  let bars: 1 | 2 | 3 | 4 = 4;
  if (eff === 'slow-2g' || (downlink !== null && downlink > 0 && downlink < 0.25)) {
    bars = 1;
  } else if (eff === '2g' || (downlink !== null && downlink > 0 && downlink < 1.0)) {
    bars = 2;
  } else if (
    eff === '3g' ||
    (downlink !== null && downlink > 0 && downlink < 3.0) ||
    (rtt !== null && rtt > 250)
  ) {
    bars = 3;
  } else {
    bars = 4;
  }

  const parts: string[] = [];
  if (eff) parts.push(eff.toUpperCase());
  if (downlink !== null && downlink > 0) parts.push(`${downlink.toFixed(1)} Mbps`);
  const signalLabel = parts.length > 0 ? `Signal: ${parts.join(' · ')}` : 'Signal: Online';

  return { online: true, signalBars: bars, signalLabel };
}

export function useDeviceStatus(): DeviceStatus {
  const [network, setNetwork] = useState(readNetworkSignal);
  const [battery, setBattery] = useState<DeviceStatus['battery']>(null);

  useEffect(() => {
    const updateNetwork = () => setNetwork(readNetworkSignal());
    updateNetwork();

    window.addEventListener('online', updateNetwork);
    window.addEventListener('offline', updateNetwork);

    const conn = getNetworkConnection();
    conn?.addEventListener?.('change', updateNetwork);

    return () => {
      window.removeEventListener('online', updateNetwork);
      window.removeEventListener('offline', updateNetwork);
      conn?.removeEventListener?.('change', updateNetwork);
    };
  }, []);

  useEffect(() => {
    if (typeof navigator === 'undefined') return;
    const nav = navigator as Navigator & {
      getBattery?: () => Promise<BatteryManager>;
    };
    if (typeof nav.getBattery !== 'function') return;

    let active = true;
    let manager: BatteryManager | null = null;

    const syncBattery = () => {
      if (!active || !manager) return;
      const pct = Math.max(0, Math.min(100, Math.round(manager.level * 100)));
      setBattery({
        levelPct: pct,
        charging: Boolean(manager.charging),
      });
    };

    nav
      .getBattery()
      .then((bat) => {
        if (!active) return;
        manager = bat;
        syncBattery();
        bat.addEventListener('levelchange', syncBattery);
        bat.addEventListener('chargingchange', syncBattery);
      })
      .catch(() => {
        // Battery API unavailable or blocked by browser permissions
      });

    return () => {
      active = false;
      if (manager) {
        manager.removeEventListener('levelchange', syncBattery);
        manager.removeEventListener('chargingchange', syncBattery);
      }
    };
  }, []);

  return {
    ...network,
    battery,
  };
}
