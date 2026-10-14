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

export function rankedMatchPlayers(result) {
  const players = [...(result?.players || [])];
  players.sort((a, b) => Number(a.forfeited === true) - Number(b.forfeited === true)
    || Number(b.id === result.winner) - Number(a.id === result.winner)
    || (b.kills || 0) - (a.kills || 0)
    || (b.lives || 0) - (a.lives || 0)
    || (b.damage || 0) - (a.damage || 0));
  return players.reduce((rows, player, index) => {
    const previous = rows.at(-1);
    const sameScore = !result.winner && previous && Boolean(previous.forfeited) === Boolean(player.forfeited)
      && (previous.kills || 0) === (player.kills || 0)
      && (previous.lives || 0) === (player.lives || 0)
      && (previous.damage || 0) === (player.damage || 0);
    const rank = sameScore ? previous.rank : index + 1;
    rows.push({ ...player, rank, outcome: player.forfeited ? '退出'
      : player.id === result.winner ? '勝利' : result.winner || rank > 1 ? '敗北' : '引き分け' });
    return rows;
  }, []);
}

export function spectatorTarget(players, ownId, currentId = null, advance = false) {
  const available = players.filter((player) => player.id !== ownId && player.lives > 0);
  if (!available.length) return null;
  const index = available.findIndex((player) => player.id === currentId);
  return available[index < 0 ? 0 : advance ? (index + 1) % available.length : index];
}
