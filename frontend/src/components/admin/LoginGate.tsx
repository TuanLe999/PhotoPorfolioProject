import { useState } from 'react';
import { api } from '../../api/client';

export function LoginGate({
  usingDefaultPassword,
  onLoggedIn,
}: {
  usingDefaultPassword: boolean;
  onLoggedIn: (usingDefaultPassword: boolean) => void;
}) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState(
    usingDefaultPassword ? 'Gợi ý: mật khẩu mặc định là admin123 (nên đổi trên server).' : '',
  );
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await api.login(password);
      onLoggedIn(res.usingDefaultPassword);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="adm-login">
      <form className="adm-login__box" onSubmit={submit}>
        <h1>Trang quản trị</h1>
        <p>Nhập mật khẩu admin để chỉnh sửa portfolio.</p>
        <input
          className="inp"
          type="password"
          placeholder="Mật khẩu"
          autoComplete="current-password"
          value={password}
          autoFocus
          required
          onChange={(e) => setPassword(e.target.value)}
        />
        <div className="adm-login__err">{error}</div>
        <button className="ui-btn ui-btn--primary ui-btn--block" type="submit" disabled={busy}>
          {busy ? 'Đang kiểm tra…' : 'Đăng nhập'}
        </button>
      </form>
    </div>
  );
}
