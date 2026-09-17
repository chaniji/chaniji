```ts
          /\
         /**\
        /****\   /\
       /      \ /**\
      /  /\    /    \        /\    /\  /\      /\            /\/\/\  /\
     /  /  \  /      \      /  \/\/  \/  \  /\/  \/\  /\  /\/ / /  \/  \
    /  /    \/ /\     \    /    \ \  /    \/ /   /  \/  \/  \  /    \   \
   /  /      \/  \/\   \  /      \    /   /    \
__/__/_______/___/__\___\__________________________________________________

const order = ["profile", "identity", "philosophy", "setup", "tools", "favourites"];
const all = [
  { name: "profile", value: ["Chandramouli", getAge(2004)] },
  { name: "identity", value: ["Programmer", "Writer", "Philosopher", "Graphics Designer"] },
  { name: "philosophy", value: [...new Set(["Minimalism", "Stoicism", "NeoMarxist"])] },
  { name: "setup", value: { theme: "Gruvbox Dark", font: "JetBrains Mono Nerd Font" } },
  { name: "tools", value: ["Curl", "Fzf", "Zoxide", "Tmux", "Ripgrep", "Alacritty", "Devilspie2", "Neovim", "Opencode", "Lazydocker", "Lazygit", "Lazysql", "Pass"] },
  { name: "favourites", value: ["Postgres", "Kafka", "Docker", "Java", "Git", "Spring", "NextJS", "Terraform", "Hadoop"] }
].sort((a, b) => order.indexOf(a.name) - order.indexOf(b.name));
function getAge(birthYear: number): number {
  return new Date().getFullYear() - birthYear;
}
all.forEach(g => {
  const val = Array.isArray(g.value)
    ? g.value.join(", ")
    : Object.entries(g.value).map(([k, v]) => `${k}=${v}`).join(", ");
  console.log(`${g.name[0].toUpperCase() + g.name.slice(1)}: ${val}`);
});
__________________________________________________________________________
Output:
Profile: Chandramouli, 22
Identity: Programmer, Writer, Philosopher, Graphics Designer
Philosophy: Minimalism, Stoicism, NeoMarxist
Setup: theme=Gruvbox Dark, font=JetBrains Mono Nerd Font
Tools: Curl, Fzf, Zoxide, Tmux, Ripgrep, Alacritty, Devilspie2, Neovim, Opencode, Lazydocker, Lazygit, Lazysql, Pass
Favourites: Postgres, Kafka, Docker, Java, Git, Spring, Terraform, Hadoop
__________________________________________________________________________
```
