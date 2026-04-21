pub const ROUNDS_PER_RUN: u32 = 12;
pub const QUOTA_BASE: f64 = 69.0;
pub const QUOTA_GROWTH: f64 = 1.2;

pub const SURPLUS_CONVERSION_RATE: u32 = 20;

pub const SHOP_REROLL_BASE: u32 = 5;
pub const SHOP_PRICE_SCALING: f64 = 0.5;

pub const TICKETS_PER_ROUND: u32 = 15;
pub const INITIAL_CORRUPTION: f64 = 0.5;

#[inline]
pub fn quota(round: u32) -> u32 {
    (QUOTA_BASE * QUOTA_GROWTH.powi(round as i32 - 1)).floor() as u32
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
}
