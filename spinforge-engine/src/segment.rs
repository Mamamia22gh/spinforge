#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum SegmentKind {
    Neutral,
    Golden,
    Corrupted,
}

#[derive(Clone, Copy, Debug)]
pub struct Segment {
    pub value: i32,
    pub weight: u8,
    pub kind: SegmentKind,
}

impl Segment {
    pub fn new(kind: SegmentKind) -> Self {
        Self { value: 0, weight: 1, kind }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn default_segment() {
        let s = Segment::new(SegmentKind::Neutral);
        assert_eq!(s.value, 0);
        assert_eq!(s.weight, 1);
        assert_eq!(s.kind, SegmentKind::Neutral);
    }

    #[test]
    fn segment_is_copy() {
        let a = Segment::new(SegmentKind::Golden);
        let b = a;
        assert_eq!(a.kind, b.kind);
    }
}
