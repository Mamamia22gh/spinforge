pub const ROUNDS_PER_RUN: u32 = 15;

pub const QUOTA: [u32; 15] = [
    60, 190, 374, 612, 909,
    1267, 1688, 2174, 2730, 3360,
    4067, 4862, 5762, 6778, 7926,
];

pub const SURPLUS_CONVERSION_RATE: u32 = 20;

pub const SHOP_REROLL_BASE: u32 = 5;
pub const SHOP_PRICE_SCALING: f64 = 0.5;

pub const TICKETS_PER_ROUND: u32 = 15;
pub const INITIAL_CORRUPTION: f64 = 0.5;

#[inline]
pub fn quota(round: u32) -> u32 {
    QUOTA[(round as usize).saturating_sub(1).min(QUOTA.len() - 1)]
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn quota_round_1() {
        assert_eq!(quota(1), 60);
    }

    #[test]
    fn quota_round_5() {
        assert_eq!(quota(5), 909);
    }

    #[test]
    fn quota_round_12() {
        assert_eq!(quota(12), 4862);
    }

    #[test]
    fn quota_round_15() {
        assert_eq!(quota(15), 7926);
    }
}
