export default function Home() {
  // Replace with chessboards
  const items = [1, 2, 3, 4, 5, 6];
  return (
    <div className="grid grid-cols-3 w-full text-center gap-20">
      {items.map((item: number) => (
        <code key={item}>{item}</code>
      ))}
    </div>
  );
}
