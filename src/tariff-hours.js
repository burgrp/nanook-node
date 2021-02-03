module.exports = {
    parseHours(str) {
        return (str || "")
            .split(",")
            .map(s => s.trim())
            .filter(s => s !== "")
            .map(s => s
                .split("-")
                .map(h => h.trim())
                .filter(h => h !== "")
                .map(h => h
                    .split(":")
                    .map(n => n.trim())
                    .filter(n => n !== "")
                    .map(n => parseInt(n))
                    .filter(n => isFinite(n))
                    .map((n, i) => n * Math.pow(60, 2 - i) * 1000)
                    .reduce((acc, sec) => acc + sec, 0)
                )
            ).map(h => ({
                from: h[0],
                to: h[1] === undefined ? h[0] + 3600000 : h[1]
            }))
    },

    isHighTariff(date, parsedHours) {
        let midnight = new Date(date);
        midnight.setHours(0);
        midnight.setMinutes(0);
        midnight.setSeconds(0);
        midnight.setMilliseconds(0);
        let ms = date.getTime() - midnight.getTime();
        return parsedHours.some(h => h.from <= ms && ms <= h.to);
    }
}
