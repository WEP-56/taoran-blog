import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { contentDir } from "./sync";

export const friendSchema = z.object({
  name: z.string().min(1).max(40),
  url: z.url().max(200),
  avatar: z.url().max(300).or(z.literal("")),
  desc: z.string().min(1).max(120),
});

export type Friend = z.infer<typeof friendSchema>;

const friendsFile = () => path.join(contentDir, "friends.json");

export function listFriends(): Friend[] {
  const file = friendsFile();
  if (!existsSync(file)) return [];
  const data = JSON.parse(readFileSync(file, "utf-8")) as { friends?: unknown[] };
  return z.array(friendSchema).parse(data.friends ?? []);
}

export function addFriend(input: Friend): Friend {
  const friend = friendSchema.parse(input);
  const friends = listFriends();
  if (friends.some((f) => f.url === friend.url)) throw new Error("这个友链地址已存在");
  writeFriends([...friends, friend]);
  return friend;
}

export function deleteFriend(url: string): boolean {
  const friends = listFriends();
  const next = friends.filter((f) => f.url !== url);
  if (next.length === friends.length) return false;
  writeFriends(next);
  return true;
}

function writeFriends(friends: Friend[]): void {
  writeFileSync(
    friendsFile(),
    `${JSON.stringify(
      {
        _comment: "友链快照：由 admin 管理并同步此文件，构建只读这里。",
        friends,
      },
      null,
      2,
    )}\n`,
    "utf-8",
  );
}
