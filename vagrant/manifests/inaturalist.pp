include apt
include postgresql

# The sources.list that ships with the vagrant box is no good, so just
# clobber it.
file { "/etc/apt/sources.list":
  ensure => absent,
}
apt::source { "security":
  source  => "deb http://security.debian.org/ squeeze/updates main contrib non-free",
  require => File["/etc/apt/sources.list"],
}
apt::primary_mirror {"nz":
  require => Apt::Source["security"],
  before  => Package["postgresql-8.4"],
}

# Make sure the apt mirro is set up before any packages are installed
#Package <| |> -> Apt::Primary_mirror["nz"]

package {"postgresql-8.4-postgis": require => Package["postgresql-8.4"]}
postgresql::db { "template_postgis":
  is_template => true,
  user        => 'vagrant',
  encoding    => "UTF8",
  require     => Package["postgresql-8.4-postgis"]
}
postgresql::language { "plpgsql":
  database  => "template_postgis",
  require   => Postgresql::Db["template_postgis"],
}
postgresql::sqlfile { "/usr/share/postgresql/8.4/contrib/postgis-1.5/postgis.sql":
  database  => "template_postgis",
  require   => Postgresql::Language["plpgsql"],
  unless    => "/usr/bin/psql -tA --command '\\df st_spheroid_in' template_postgis | grep -q st_spheroid_in",
}
postgresql::sqlfile { "/usr/share/postgresql/8.4/contrib/postgis-1.5/spatial_ref_sys.sql":
  database  => "template_postgis",
  require   => Postgresql::Sqlfile["/usr/share/postgresql/8.4/contrib/postgis-1.5/postgis.sql"],
  unless    => "/usr/bin/psql -tA --command 'SELECT srid FROM spatial_ref_sys WHERE srid = 3819' template_postgis | grep -q 3819",
}
postgresql::user { "vagrant":
  createdb  => true,
  password  => 'vagrant',
}
postgresql::db {["inaturalist_development", "inaturalist_test"]:
  template  => "template_postgis",
  owner     => 'vagrant',
  user      => 'vagrant',
  encoding  => 'UTF8',
  require   => [
    Postgresql::Sqlfile["/usr/share/postgresql/8.4/contrib/postgis-1.5/spatial_ref_sys.sql"],
    Postgresql::User["vagrant"],
  ],
}
# The template_postgis database has two tables, and these seem to inherit the
# owner from the template db ('postgres') rather that the specified owner, so
# need to change the owner.
postgresql::sqlexec {"alter test template table owners":
  sql       => "ALTER TABLE geometry_columns OWNER TO vagrant;ALTER TABLE spatial_ref_sys OWNER TO vagrant",
  database  => "template_postgis",
  unless    => "/usr/bin/psql -At --command='\\dt geometry_columns' template_postgis | cut -d '|' -f 4 | grep '^vagrant$'",
  require   => Postgresql::Db["template_postgis"],
}

package {["sphinxsearch", "ruby", "rubygems", "libxml2-dev", "libxslt1-dev",
          "libpq-dev"]:
  ensure  => present,
  require => Exec["aptitude_update"],
}

package {"bundler":
  provider  => gem,
  require   => Package["rubygems"],
}
exec {"/var/lib/gems/1.8/bin/bundle":
  cwd     => '/vagrant',
  require => Package["bundler"],
}
