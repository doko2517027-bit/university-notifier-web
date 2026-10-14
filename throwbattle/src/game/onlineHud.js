export function opponentRows(players, ownId) {
  return players.filter((player) => player.id !== ownId).map((player) => {
    const maxHp = Math.max(1, Number(player.maxHp) || 1);
    const hp = Math.max(0, Number(player.hp) || 0);
    const lives = Math.max(0, Number(player.lives) || 0);
    const status = lives === 0 ? '脱落' : player.connected === false ? '再接続待ち'
      : player.respawnSeconds > 0 ? `復活まで${player.respawnSeconds}秒` : '対戦中';
    return { id: player.id, name: player.name || '対戦相手', hp, lives,
      hpPercent: Math.min(100, Math.round(hp / maxHp * 100)), status };
  });
}
