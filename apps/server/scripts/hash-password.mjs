// 用法：node scripts/hash-password.mjs <你的口令>
// 输出 Argon2id 哈希，填入 .env 的 ADMIN_PASSWORD_HASH
import { hash } from "@node-rs/argon2";

const password = process.argv[2];
if (!password || password.length < 8) {
  console.error("用法：node scripts/hash-password.mjs <至少 8 位口令>");
  process.exit(1);
}

console.log(await hash(password, { memoryCost: 19456, timeCost: 2, parallelism: 1 }));
