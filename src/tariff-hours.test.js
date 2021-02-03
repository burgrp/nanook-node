let tariffHours = require("./tariff-hours.js");

let testExp = "3:30-5:30:45 ,10, 12: 30-15,";

test("parses hours", () => {    
    expect(tariffHours.parseHours(testExp)).toEqual([
        { from: 3.5 * 3600000, to: 5.5125 * 3600000 },
        { from: 10 * 3600000, to: 11 * 3600000 },
        { from: 12.5 * 3600000, to: 15 * 3600000 }
    ]);
});

test("parses 'undefined' hours", () => {    
    expect(tariffHours.parseHours()).toEqual([]);
});

test("parses empty hours", () => {    
    expect(tariffHours.parseHours("  ")).toEqual([]);
});

test("matches hours", () => {
    let parsedHours = tariffHours.parseHours(testExp);
    expect(tariffHours.isHighTariff(new Date("2021-02-03T03:30:00+01:00"), parsedHours)).toBe(true);
    expect(tariffHours.isHighTariff(new Date("2021-02-03T05:30:00+01:00"), parsedHours)).toBe(true);
});

test("doesn't match hours (low bound)", () => {
    let parsedHours = tariffHours.parseHours(testExp);
    expect(tariffHours.isHighTariff(new Date("2021-02-03T01:30:00+01:00"), parsedHours)).toBe(false);
});

test("doesn't match hours (inside)", () => {
    let parsedHours = tariffHours.parseHours(testExp);
    expect(tariffHours.isHighTariff(new Date("2021-02-03T09:00:00+01:00"), parsedHours)).toBe(false);
});

test("doesn't match hours (high bound)", () => {
    let parsedHours = tariffHours.parseHours(testExp);
    expect(tariffHours.isHighTariff(new Date("2021-02-03T23:45:00+01:00"), parsedHours)).toBe(false);
});

