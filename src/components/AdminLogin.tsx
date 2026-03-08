import { useState } from "react";
import { Leaf, Lock, Eye, EyeOff } from "lucide-react";
import { motion } from "framer-motion";
import herbalHero from "@/assets/herbal-hero.png";

interface AdminLoginProps {
  onLogin: () => void;
}

const ADMIN_PASS = "sakura4923";

const AdminLogin = ({ onLogin }: AdminLoginProps) => {
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);
  const [showPass, setShowPass] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === ADMIN_PASS) {
      sessionStorage.setItem("admin_auth", "true");
      onLogin();
    } else {
      setError(true);
      setTimeout(() => setError(false), 2000);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-card rounded-2xl border border-border shadow-herbal p-8 w-full max-w-sm text-center"
      >
        <img src={herbalHero} alt="สมุนไพร" className="w-20 h-20 object-contain mx-auto mb-4" />
        <div className="w-12 h-12 rounded-full gradient-herbal flex items-center justify-center mx-auto mb-4 shadow-herbal">
          <Lock className="w-5 h-5 text-primary-foreground" />
        </div>
        <h2 className="text-xl font-bold font-thai text-foreground mb-1">เข้าสู่ระบบผู้ดูแล</h2>
        <p className="text-sm text-muted-foreground mb-6">กรุณากรอกรหัสผ่านเพื่อเข้าสู่แดชบอร์ด</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <input
              type={showPass ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="รหัสผ่าน"
              className={`w-full px-4 py-3 rounded-xl border text-sm bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 transition-all ${
                error ? "border-destructive focus:ring-destructive" : "border-border focus:ring-ring"
              }`}
              autoFocus
            />
            <button
              type="button"
              onClick={() => setShowPass(!showPass)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          {error && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-sm text-destructive"
            >
              รหัสผ่านไม่ถูกต้อง
            </motion.p>
          )}

          <button
            type="submit"
            className="w-full py-3 rounded-xl gradient-herbal text-primary-foreground font-medium text-sm shadow-herbal hover:opacity-90 transition-opacity"
          >
            เข้าสู่ระบบ
          </button>
        </form>

        <a href="/" className="inline-block mt-4 text-sm text-muted-foreground hover:text-primary transition-colors">
          ← กลับหน้าแชท
        </a>
      </motion.div>
    </div>
  );
};

export default AdminLogin;
