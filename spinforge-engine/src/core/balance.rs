pub const ROUNDS_PER_RUN: u32 = 15;

pub const QUOTA: [u32; 15] = [
    69, 82, 99, 119, 143,
    172, 206, 248, 297, 357,
    428, 512, 615, 738, 886,
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
        assert_eq!(quota(1), 69);
    }

    #[test]
    fn quota_round_5() {
        assert_eq!(quota(5), 143);
    }

    #[test]
    fn quota_round_12() {
        assert_eq!(quota(12), 512);
    }

    #[test]
    fn quota_round_15() {
        assert_eq!(quota(15), 886);
    }
}
