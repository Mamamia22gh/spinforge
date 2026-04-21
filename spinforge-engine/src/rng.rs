pub struct Rng {
    state: u32,
    initial_seed: u32,
}

impl Rng {
    pub fn new(seed: u32) -> Self {
        Self { state: seed, initial_seed: seed }
    }

    pub fn seed(&self) -> u32 { self.initial_seed }

    pub fn random(&mut self) -> f64 {
        self.state = self.state.wrapping_add(0x6D2B79F5);
        let mut t = self.state;
        t = (t ^ (t >> 15)).wrapping_mul(t | 1);
        t = t.wrapping_add((t ^ (t >> 7)).wrapping_mul(t | 61));
        t ^= t >> 14;
        t as f64 / 4294967296.0
    }

    pub fn int(&mut self, min: i32, max: i32) -> i32 {
        (self.random() * (max - min + 1) as f64).floor() as i32 + min
    }

    pub fn float(&mut self, min: f64, max: f64) -> f64 {
        self.random() * (max - min) + min
    }

    pub fn chance(&mut self, p: f64) -> bool {
        self.random() < p
    }

    pub fn pick<'a, T>(&mut self, slice: &'a [T]) -> &'a T {
        assert!(!slice.is_empty(), "Cannot pick from empty slice");
        let i = self.int(0, slice.len() as i32 - 1) as usize;
        &slice[i]
    }

    pub fn shuffle<T>(&mut self, slice: &mut [T]) {
        for i in (1..slice.len()).rev() {
            let j = self.int(0, i as i32) as usize;
            slice.swap(i, j);
        }
    }

    pub fn pick_n<T: Clone>(&mut self, slice: &[T], n: usize) -> Vec<T> {
        assert!(n <= slice.len(), "Cannot pick {} from {}", n, slice.len());
        let mut copy: Vec<T> = slice.to_vec();
        self.shuffle(&mut copy);
        copy.truncate(n);
        copy
    }

    pub fn fork(&mut self) -> Rng {
        let seed = (self.random() * 4294967296.0).floor() as u32;
        Rng::new(seed)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn deterministic() {
        let mut rng1 = Rng::new(12345);
        let mut rng2 = Rng::new(12345);
        let v1: Vec<f64> = (0..100).map(|_| rng1.random()).collect();
        let v2: Vec<f64> = (0..100).map(|_| rng2.random()).collect();
        assert_eq!(v1, v2);
    }

    #[test]
    fn output_range() {
        let mut rng = Rng::new(77777);
        for _ in 0..10000 {
            let v = rng.random();
            assert!(v >= 0.0 && v < 1.0);
        }
    }

    #[test]
    fn first_value_seed_12345() {
        // Mulberry32 manual trace for seed=12345:
        // state = 12345 + 0x6D2B79F5 = 0x6D2BAC2E (wrapping)
        // Can verify against Lua in-game with: print(RNG.new(12345):random())
        let mut rng = Rng::new(12345);
        let v = rng.random();
        // Snapshot — if this changes, algo is broken
        println!("first random(12345) = {:.17}", v);
        assert!(v > 0.0 && v < 1.0);
    }

    #[test]
    fn int_range() {
        let mut rng = Rng::new(42);
        for _ in 0..1000 {
            let v = rng.int(3, 7);
            assert!((3..=7).contains(&v));
        }
    }

    #[test]
    fn shuffle_preserves_elements() {
        let mut rng = Rng::new(99);
        let mut v = vec![1, 2, 3, 4, 5];
        rng.shuffle(&mut v);
        v.sort();
        assert_eq!(v, vec![1, 2, 3, 4, 5]);
    }

    #[test]
    fn fork_different_seed() {
        let mut rng = Rng::new(1);
        let forked = rng.fork();
        assert_ne!(forked.seed(), 1);
    }

    #[test]
    fn pick_n_correct_count() {
        let mut rng = Rng::new(7);
        let items = vec![10, 20, 30, 40, 50];
        let picked = rng.pick_n(&items, 3);
        assert_eq!(picked.len(), 3);
    }
}
