import SearchForm from "./_components/composed/SearchForm/SearchForm.client";

export default function HomePage() {
  return (
    <div className="flex flex-col items-center w-full py-8 px-4">
      <h1 className="text-lg mb-6 text-center">
        Look up Chess.com and Lichess games
      </h1>
      <SearchForm />
    </div>
  );
}
